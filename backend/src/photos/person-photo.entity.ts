import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('person_photos')
export class PersonPhoto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  contentType: string;

  @Column({ type: 'bytea' })
  data: Buffer;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
