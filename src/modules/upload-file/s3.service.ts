import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { Injectable } from '@nestjs/common'
import config from '../../config'

@Injectable()
export class S3Service {
  private s3 = new S3Client({
    region: 'eu-central-1',
    credentials: {
      accessKeyId: config.s3.key!,
      secretAccessKey: config.s3.secret!,
    },
  })

  private bucket = config.s3.bucket!

  async upload(opts: { key: string; buffer: Buffer; contentType?: string; cacheControl?: string }) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: opts.key,
        Body: opts.buffer,
        ContentType: opts.contentType,
        CacheControl: opts.cacheControl ?? 'public, max-age=31536000, immutable',
      }),
    )

    return
  }

  //   async head(key: string) {
  //     const Key = this.key(key)
  //     try {
  //       return await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key }))
  //     } catch {
  //       throw new NotFoundException('File not found')
  //     }
  //   }

  //   async getStream(key: string): Promise<{ stream: Readable; contentType?: string; contentLength?: number }> {
  //     const Key = this.key(key)
  //     try {
  //       const obj = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key }))
  //       const stream: Readable = obj.Body as Readable
  //       return { stream, contentType: obj.ContentType, contentLength: obj.ContentLength }
  //     } catch {
  //       throw new NotFoundException('File not found')
  //     }
  //   }

  //   async remove(key: string) {
  //     const Key = this.key(key)
  //     await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key }))
  //     return { deleted: true, key: Key }
  //   }
}
