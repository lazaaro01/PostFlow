export class StorageService {
  async uploadImage(buffer: Buffer, filename: string): Promise<string> {
    return `/uploads/${filename}`;
  }
}
