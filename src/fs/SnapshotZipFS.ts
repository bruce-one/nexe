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

// @ts-ignore: TS2341
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
}

for (const k of Reflect.ownKeys(ZipOpenFS.prototype)) {
  // @ts-ignore: TS2341
  if (k !== 'libzip' && !SnapshotZipFS.prototype[k]) {
    // @ts-ignore: TS2341
    SnapshotZipFS.prototype[k] = ZipOpenFS.prototype[k]
  }
}
