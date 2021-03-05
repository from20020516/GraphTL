import { BaseEntity, Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { Tweet } from './Tweet'

@Entity()
export class User extends BaseEntity {
    @PrimaryGeneratedColumn()
    id: number

    @Column({ unique: true })
    id_str: string

    @Column()
    username: string

    @Column({ type: 'text', nullable: false, comment: 'DO NOT use json type on MySQL5.7.' })
    data: string

    @CreateDateColumn()
    created_at: Date

    @UpdateDateColumn()
    updated_at: Date

    @OneToMany(type => Tweet, tweet => tweet.user)
    tweets?: Tweet[]
}
