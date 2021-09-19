import { Libzip } from '@yarnpkg/libzip'
import { FakeFS, PortablePath, ZipFS, ZipOpenFS } from '@yarnpkg/fslib'
import { ZipOpenFSOptions } from '@yarnpkg/fslib/lib/ZipOpenFS'
import { BasePortableFakeFS } from '@yarnpkg/fslib/lib/FakeFS'
import { FSPath, npath } from '@yarnpkg/fslib/lib/path'
import { resolve } from 'path'

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

  // @ts-ignore
  async makeCallPromise<T>(
    p: FSPath<PortablePath>,
    discard: () => Promise<T>,
    accept: (zipFS: ZipFS, zipInfo: { subPath: PortablePath }) => Promise<T>,
    { requireSubpath = true }: { requireSubpath?: boolean } = {}
  ): Promise<T> {
    if (typeof p !== `string`) return await discard()

    // @ts-ignore: TS2341
    const normalizedP = this.resolve(p)

    // @ts-ignore: TS2341
    const zipInfo = this.findZip(normalizedP)
    if (!zipInfo) return await discard()

    if (requireSubpath && zipInfo.subPath === `/`) return await discard()

    // @ts-ignore: TS2341
    return await accept(this.zipFs, zipInfo)
  }

  // @ts-ignore
  makeCallSync<T>(
    p: FSPath<PortablePath>,
    discard: () => T,
    accept: (zipFS: ZipFS, zipInfo: { subPath: PortablePath }) => T,
    { requireSubpath = true }: { requireSubpath?: boolean } = {}
  ): T {
    if (typeof p !== `string`) return discard()

    // @ts-ignore: TS2341
    const normalizedP = this.resolve(p)

    // @ts-ignore: TS2341
    const zipInfo = this.findZip(normalizedP)
    if (!zipInfo) return discard()

    if (requireSubpath && zipInfo.subPath === `/`) return discard()

    // @ts-ignore: TS2341
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
        subPath: npath.toPortablePath(p),
      }
    }
  }

  accessPromise = ZipOpenFS.prototype.accessPromise
  accessSync = ZipOpenFS.prototype.accessSync
  appendFilePromise = ZipOpenFS.prototype.appendFilePromise
  appendFileSync = ZipOpenFS.prototype.appendFileSync
  chmodPromise = ZipOpenFS.prototype.chmodPromise
  chmodSync = ZipOpenFS.prototype.chmodSync
  chownPromise = ZipOpenFS.prototype.chownPromise
  chownSync = ZipOpenFS.prototype.chownSync
  closePromise = ZipOpenFS.prototype.closePromise
  closeSync = ZipOpenFS.prototype.closeSync
  copyFilePromise = ZipOpenFS.prototype.copyFilePromise
  copyFileSync = ZipOpenFS.prototype.copyFileSync
  createReadStream = ZipOpenFS.prototype.createReadStream
  createWriteStream = ZipOpenFS.prototype.createWriteStream
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
  writeFilePromise = ZipOpenFS.prototype.writeFilePromise
  writeFileSync = ZipOpenFS.prototype.writeFileSync
  writePromise = ZipOpenFS.prototype.writePromise
  writeSync = ZipOpenFS.prototype.writeSync

  // @ts-ignore
  remapFd = ZipOpenFS.prototype.remapFd
}
