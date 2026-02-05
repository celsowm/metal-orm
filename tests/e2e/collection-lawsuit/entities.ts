import { col } from '../../../src/schema/column-types.js';
import type { BelongsToReference, HasManyCollection } from '../../../src/schema/types.js';
import {
  Column,
  Entity,
  HasMany,
  BelongsTo,
  PrimaryKey
} from '../../../src/decorators/index.js';

@Entity()
export class Attorney {
  @PrimaryKey(col.int()) id!: number;
  @Column(col.notNull(col.varchar(100))) name!: string;
  @Column(col.notNull(col.varchar(255))) email!: string;
  @Column(col.varchar(20)) oabNumber!: string;
  @Column(col.varchar(20)) phone?: string;
  @HasMany({ target: () => CollectionLawsuit, foreignKey: 'attorneyId' })
  collectionLawsuits!: HasManyCollection<CollectionLawsuit>;
}

@Entity()
export class CollectionLawsuit {
  @PrimaryKey(col.int()) id!: number;
  @Column(col.notNull(col.varchar(50))) caseNumber!: string;
  @Column(col.text()) description!: string;
  @Column(col.decimal(15, 2)) amount!: number;
  @Column(col.varchar(50)) status!: 'pending' | 'active' | 'closed' | 'suspended';
  @Column(col.int()) attorneyId!: number;
  @BelongsTo({ target: () => Attorney, foreignKey: 'attorneyId' })
  attorney?: Attorney;
}
