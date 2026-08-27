import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * The nominate-able roster, imported from a Slack member-list CSV export by an admin.
 * Deliberately separate from `User`: most employees here have never signed into the
 * GRIT app themselves, so there is no session/role/picture data to attach to them.
 */
@Entity('directory_people')
export class DirectoryPerson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
