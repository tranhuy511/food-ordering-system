import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    @Column({ length: 100 })
    fullName: string;
    @Column({ unique: true, length: 150})
    email: string;
    @Column({ select: false })
    password: string;
    @Column({ nullable: true, length:20})
    phone: string;
    @Column({ default: 'customer', length: 30})
    role: string;
    @CreateDateColumn()
    createdAt: Date;
    @UpdateDateColumn()
    updatedAt: Date;
}    