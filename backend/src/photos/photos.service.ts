import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Nomination } from '../nominations/nomination.entity';
import { PersonPhoto } from './person-photo.entity';

export interface PhotoSummary {
  email: string;
  updatedAt: Date;
}

export interface DirectoryEntry {
  email: string;
  name: string;
  hasPhoto: boolean;
  updatedAt: Date | null;
}

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class PhotosService {
  constructor(
    @InjectRepository(PersonPhoto)
    private readonly photosRepository: Repository<PersonPhoto>,
    @InjectRepository(Nomination)
    private readonly nominationsRepository: Repository<Nomination>,
  ) {}

  async findByEmail(email: string): Promise<PersonPhoto | null> {
    return this.photosRepository.findOne({ where: { email: this.normalize(email) } });
  }

  async upsert(email: string, file?: Express.Multer.File): Promise<PhotoSummary> {
    if (!file) {
      throw new BadRequestException('An image file is required');
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Unsupported image type. Use PNG, JPEG, WEBP, or GIF.');
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException('Image must be smaller than 5MB.');
    }

    const normalizedEmail = this.normalize(email);
    let photo = await this.photosRepository.findOne({ where: { email: normalizedEmail } });
    if (!photo) {
      photo = this.photosRepository.create({ email: normalizedEmail });
    }
    photo.contentType = file.mimetype;
    photo.data = file.buffer;

    const saved = await this.photosRepository.save(photo);
    return this.toSummary(saved);
  }

  async remove(email: string): Promise<void> {
    const result = await this.photosRepository.delete({ email: this.normalize(email) });
    if (!result.affected) {
      throw new NotFoundException('No photo found for that email');
    }
  }

  async listSummaries(): Promise<PhotoSummary[]> {
    const photos = await this.photosRepository.find({ order: { updatedAt: 'DESC' } });
    return photos.map((p) => this.toSummary(p));
  }

  async directory(): Promise<DirectoryEntry[]> {
    const [nominations, photos] = await Promise.all([
      this.nominationsRepository.find(),
      this.photosRepository.find(),
    ]);

    const photosByEmail = new Map(photos.map((p) => [p.email, p]));
    const byEmail = new Map<string, DirectoryEntry>();

    for (const nomination of nominations) {
      const email = this.normalize(nomination.nomineeEmail);
      if (!byEmail.has(email)) {
        const photo = photosByEmail.get(email);
        byEmail.set(email, {
          email,
          name: nomination.nomineeName,
          hasPhoto: !!photo,
          updatedAt: photo?.updatedAt ?? null,
        });
      }
    }

    for (const photo of photos) {
      if (!byEmail.has(photo.email)) {
        byEmail.set(photo.email, {
          email: photo.email,
          name: photo.email,
          hasPhoto: true,
          updatedAt: photo.updatedAt,
        });
      }
    }

    return Array.from(byEmail.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  private normalize(email: string): string {
    return email.trim().toLowerCase();
  }

  private toSummary(photo: PersonPhoto): PhotoSummary {
    return { email: photo.email, updatedAt: photo.updatedAt };
  }
}
