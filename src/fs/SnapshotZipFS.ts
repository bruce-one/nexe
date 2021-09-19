import { Libzip } from '@yarnpkg/libzip'
import { FakeFS, PortablePath, ZipFS, ZipOpenFS } from '@yarnpkg/fslib'
import { ZipOpenFSOptions } from '@yarnpkg/fslib/lib/ZipOpenFS'
import {
  WriteFileOptions,
  CreateWriteStreamOptions,
  BasePortableFakeFS,
} from '@yarnpkg/fslib/lib/FakeFS'
import { FSPath } from '@yarnpkg/fslib/lib/path'
import { resolve } from 'path'
import { WriteStream, constants } from 'fs'

export type SnapshotZipFSOptions = {
  baseFs: FakeFS<PortablePath>
  libzip: Libzip | (() => Libzip)
  zipFs: ZipFS
}

export class SnapshotZipFS extends BasePortableFakeFS {
  zipFs: ZipFS
  baseFs: FakeFS<PortablePath>
  constructor(opts: SnapshotZipFSOptions) {
    super()
    this.zipFs = opts.zipFs
    this.baseFs = opts.baseFs
  }
  private readonly fdMap: Map<number, [ZipFS, number]> = new Map()
  private nextFd = 3

  async makeCallPromise<T>(
    p: FSPath<PortablePath>,
    discard: () => Promise<T>,
    accept: (zipFS: ZipFS, zipInfo: { subPath: PortablePath }) => Promise<T>,
    { requireSubpath = true }: { requireSubpath?: boolean } = {}
  ): Promise<T> {
    if (typeof p !== 'string') return await discard()

    const normalizedP = this.resolve(p)

    const zipInfo = this.findZip(normalizedP)
    if (!zipInfo) return await discard()

    if (requireSubpath && zipInfo.subPath === '/') return await discard()

    return await accept(this.zipFs, zipInfo)
  }

  makeCallSync<T>(
    p: FSPath<PortablePath>,
    discard: () => T,
    accept: (zipFS: ZipFS, zipInfo: { subPath: PortablePath }) => T,
    { requireSubpath = true }: { requireSubpath?: boolean } = {}
  ): T {
    if (typeof p !== 'string') return discard()

    const normalizedP = this.resolve(p)

    const zipInfo = this.findZip(normalizedP)
    if (!zipInfo) return discard()

    if (requireSubpath && zipInfo.subPath === '/') return discard()

    return accept(this.zipFs, zipInfo)
  }

  async realpathPromise(p: PortablePath) {
    return await this.makeCallPromise(
      p,
      async () => {
        return await this.baseFs.realpathPromise(p)
      },
      async (zipFs, { subPath }) => {
        return await zipFs.realpathPromise(subPath)
      }
    )
  }

  realpathSync(p: PortablePath) {
    return this.makeCallSync(
      p,
      () => {
        return this.baseFs.realpathSync(p)
      },
      (zipFs, { subPath }) => {
        return zipFs.realpathSync(subPath)
      }
    )
  }

  findZip(p: PortablePath) {
    if (this.zipFs.existsSync(p)) {
      return {
        subPath: this.resolve(p),
      }
    }
  }

  createWriteStream(p: PortablePath | null, opts?: CreateWriteStreamOptions): WriteStream {
    return this.baseFs.createWriteStream(p, opts)
  }

  writeFilePromise(
    p: FSPath<PortablePath>,
    content: string | Buffer | ArrayBuffer | DataView,
    opts?: WriteFileOptions
  ): Promise<void> {
    return this.baseFs.writeFilePromise(p, content, opts)
  }

  writeFileSync(
    p: FSPath<PortablePath>,
    content: string | Buffer | ArrayBuffer | DataView,
    opts?: WriteFileOptions
  ): void {
    return this.baseFs.writeFileSync(p, content, opts)
  }

  async appendFilePromise(
    p: FSPath<PortablePath>,
    content: string | Buffer | ArrayBuffer | DataView,
    opts?: WriteFileOptions
  ) {
    return await this.baseFs.appendFilePromise(p, content, opts)
  }

  appendFileSync(
    p: FSPath<PortablePath>,
    content: string | Buffer | ArrayBuffer | DataView,
    opts?: WriteFileOptions
  ) {
    return this.baseFs.appendFileSync(p, content, opts)
  }

  async copyFilePromise(sourceP: PortablePath, destP: PortablePath, flags: number = 0) {
    const fallback = async (
      sourceFs: FakeFS<PortablePath>,
      sourceP: PortablePath,
      destFs: FakeFS<PortablePath>,
      destP: PortablePath
    ) => {
      if ((flags & constants.COPYFILE_FICLONE_FORCE) !== 0)
        throw Object.assign(
          new Error(`EXDEV: cross-device clone not permitted, copyfile '${sourceP}' -> ${destP}'`),
          { code: `EXDEV` }
        )
      if (flags & constants.COPYFILE_EXCL && (await this.existsPromise(sourceP)))
        throw Object.assign(
          new Error(`EEXIST: file already exists, copyfile '${sourceP}' -> '${destP}'`),
          { code: `EEXIST` }
        )

      let content
      try {
        content = await sourceFs.readFilePromise(sourceP)
      } catch (error) {
        throw Object.assign(
          new Error(`EINVAL: invalid argument, copyfile '${sourceP}' -> '${destP}'`),
          { code: `EINVAL` }
        )
      }

      await destFs.writeFilePromise(destP, content)
    }

    return await this.makeCallPromise(
      sourceP,
      async () => {
        return await this.baseFs.copyFilePromise(sourceP, destP, flags)
      },
      async (zipFsS, { subPath: subPathS }) => {
        return await fallback(zipFsS, subPathS, this.baseFs, destP)
      }
    )
  }

  copyFileSync(sourceP: PortablePath, destP: PortablePath, flags: number = 0) {
    const fallback = (
      sourceFs: FakeFS<PortablePath>,
      sourceP: PortablePath,
      destFs: FakeFS<PortablePath>,
      destP: PortablePath
    ) => {
      if ((flags & constants.COPYFILE_FICLONE_FORCE) !== 0)
        throw Object.assign(
          new Error(`EXDEV: cross-device clone not permitted, copyfile '${sourceP}' -> ${destP}'`),
          { code: `EXDEV` }
        )
      if (flags & constants.COPYFILE_EXCL && this.existsSync(sourceP))
        throw Object.assign(
          new Error(`EEXIST: file already exists, copyfile '${sourceP}' -> '${destP}'`),
          { code: `EEXIST` }
        )

      let content
      try {
        content = sourceFs.readFileSync(sourceP)
      } catch (error) {
        throw Object.assign(
          new Error(`EINVAL: invalid argument, copyfile '${sourceP}' -> '${destP}'`),
          { code: `EINVAL` }
        )
      }

      destFs.writeFileSync(destP, content)
    }

    return this.makeCallSync(
      sourceP,
      () => {
        return this.baseFs.copyFileSync(sourceP, destP, flags)
      },
      (zipFsS, { subPath: subPathS }) => {
        return fallback(zipFsS, subPathS, this.baseFs, destP)
      }
    )
  }

  accessPromise = ZipOpenFS.prototype.accessPromise
  accessSync = ZipOpenFS.prototype.accessSync
  chmodPromise = ZipOpenFS.prototype.chmodPromise
  chmodSync = ZipOpenFS.prototype.chmodSync
  chownPromise = ZipOpenFS.prototype.chownPromise
  chownSync = ZipOpenFS.prototype.chownSync
  closePromise = ZipOpenFS.prototype.closePromise
  closeSync = ZipOpenFS.prototype.closeSync
  createReadStream = ZipOpenFS.prototype.createReadStream
  existsPromise = ZipOpenFS.prototype.existsPromise
  existsSync = ZipOpenFS.prototype.existsSync
  fstatPromise = ZipOpenFS.prototype.fstatPromise
  fstatSync = ZipOpenFS.prototype.fstatSync
  getExtractHint = ZipOpenFS.prototype.getExtractHint
  getRealPath = ZipOpenFS.prototype.getRealPath
  linkPromise = ZipOpenFS.prototype.linkPromise
  linkSync = ZipOpenFS.prototype.linkSync
  lstatPromise = ZipOpenFS.prototype.lstatPromise
  lstatSync = ZipOpenFS.prototype.lstatSync
  mkdirPromise = ZipOpenFS.prototype.mkdirPromise
  mkdirSync = ZipOpenFS.prototype.mkdirSync
  opendirPromise = ZipOpenFS.prototype.opendirPromise
  opendirSync = ZipOpenFS.prototype.opendirSync
  openPromise = ZipOpenFS.prototype.openPromise
  openSync = ZipOpenFS.prototype.openSync
  readdirPromise = ZipOpenFS.prototype.readdirPromise
  readdirSync = ZipOpenFS.prototype.readdirSync
  readFilePromise = ZipOpenFS.prototype.readFilePromise
  readFileSync = ZipOpenFS.prototype.readFileSync
  readlinkPromise = ZipOpenFS.prototype.readlinkPromise
  readlinkSync = ZipOpenFS.prototype.readlinkSync
  readPromise = ZipOpenFS.prototype.readPromise
  readSync = ZipOpenFS.prototype.readSync
  renamePromise = ZipOpenFS.prototype.renamePromise
  renameSync = ZipOpenFS.prototype.renameSync
  resolve = ZipOpenFS.prototype.resolve
  rmdirPromise = ZipOpenFS.prototype.rmdirPromise
  rmdirSync = ZipOpenFS.prototype.rmdirSync
  statPromise = ZipOpenFS.prototype.statPromise
  statSync = ZipOpenFS.prototype.statSync
  symlinkPromise = ZipOpenFS.prototype.symlinkPromise
  symlinkSync = ZipOpenFS.prototype.symlinkSync
  truncatePromise = ZipOpenFS.prototype.truncatePromise
  truncateSync = ZipOpenFS.prototype.truncateSync
  unlinkPromise = ZipOpenFS.prototype.unlinkPromise
  unlinkSync = ZipOpenFS.prototype.unlinkSync
  unwatchFile = ZipOpenFS.prototype.unwatchFile
  utimesPromise = ZipOpenFS.prototype.utimesPromise
  utimesSync = ZipOpenFS.prototype.utimesSync
  watch = ZipOpenFS.prototype.watch
  watchFile = ZipOpenFS.prototype.watchFile
  writePromise = ZipOpenFS.prototype.writePromise
  writeSync = ZipOpenFS.prototype.writeSync

  // @ts-ignore
  remapFd = ZipOpenFS.prototype.remapFd
}
