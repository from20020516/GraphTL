import { BaseEntity, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { User } from './User'

@Entity()
export class Tweet extends BaseEntity {
    @PrimaryGeneratedColumn()
    id: number

    @Column({ unique: true })
    id_str: string

    @Column()
    user_id_str: string

    // delete by cascade when user deleted.
    @ManyToOne(type => User, user => user.tweets, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id_str', referencedColumnName: 'id_str' })
    user: User

    @Column({ type: 'text', nullable: false, comment: 'DO NOT use json type on MySQL5.7.' })
    data: string

    @CreateDateColumn()
    created_at: Date

    @UpdateDateColumn()
    updated_at: Date
}
