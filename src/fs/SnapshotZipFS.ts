import { PortablePath, ZipFS, ZipOpenFS } from '@yarnpkg/fslib'
import { ZipOpenFSOptions } from '@yarnpkg/fslib/lib/ZipOpenFS'
import { FSPath, npath } from '@yarnpkg/fslib/lib/path'
import { resolve } from 'path'

export type SnapshotZipFSOptions = ZipOpenFSOptions & {
  zipFs: ZipFS
}

export class SnapshotZipFS extends ZipOpenFS {
  zipFs: ZipFS
  constructor(opts: SnapshotZipFSOptions) {
    const { zipFs, ...superOpts } = opts
    super(superOpts)
    // @ts-ignore: TS2341
    this.zipInstances.set(process.execPath, { zipFs })
    // @ts-ignore: TS2341
    this.realPaths.set(process.execPath, '/')
    this.zipFs = zipFs
  }
}

function findZip(zipFs: ZipFS, p: PortablePath) {
  for (const path of new Set([
    p,
    resolve('/snapshot', p),
    resolve('/snapshot', p.replace(new RegExp(`^${process.cwd()}/?`), '')),
  ])) {
    // @ts-ignore: TS2341
    if (zipFs.existsSync(path)) {
      return {
        archivePath: npath.toPortablePath(process.execPath),
        subPath: npath.toPortablePath(path),
      }
    }
  }
}

// @ts-ignore: TS2341
SnapshotZipFS.prototype.makeCallPromise = async function <T>(
  p: FSPath<PortablePath>,
  discard: () => Promise<T>,
  accept: (
    zipFS: ZipFS,
    zipInfo: { archivePath: PortablePath; subPath: PortablePath }
  ) => Promise<T>,
  { requireSubpath = true }: { requireSubpath?: boolean } = {}
): Promise<T> {
  if (typeof p !== `string`) return await discard()

  // @ts-ignore: TS2341
  const normalizedP = this.resolve(p)

  // @ts-ignore: TS2341
  const zipInfo = findZip(this.zipFs, normalizedP)
  if (!zipInfo) return await discard()

  if (requireSubpath && zipInfo.subPath === `/`) return await discard()

  // @ts-ignore: TS2341
  return await this.getZipPromise(
    zipInfo.archivePath,
    async (zipFs: ZipFS) => await accept(zipFs, zipInfo)
  )
}

// @ts-ignore: TS2341
SnapshotZipFS.prototype.makeCallSync = function <T>(
  p: FSPath<PortablePath>,
  discard: () => T,
  accept: (zipFS: ZipFS, zipInfo: { archivePath: PortablePath; subPath: PortablePath }) => T,
  { requireSubpath = true }: { requireSubpath?: boolean } = {}
): T {
  if (typeof p !== `string`) return discard()

  // @ts-ignore: TS2341
  const normalizedP = this.resolve(p)

  // @ts-ignore: TS2341
  const zipInfo = findZip(this.zipFs, normalizedP)
  if (!zipInfo) return discard()

  if (requireSubpath && zipInfo.subPath === `/`) return discard()

  // @ts-ignore: TS2341
  return this.getZipSync(zipInfo.archivePath, (zipFs) => accept(zipFs, zipInfo))
}
