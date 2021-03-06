import { ConnectionOptions } from 'typeorm'
import { SnakeNamingStrategy } from 'typeorm-naming-strategies'
import * as dotenv from 'dotenv'
dotenv.config()

const ORMConfig: ConnectionOptions = {
    type: 'mysql',
    host: process.env.DB_HOST ?? 'mysql',
    port: Number(process.env.DB_PORT) ?? 3306,
    username: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE ?? 'GraphTL',
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV !== 'production',
    timezone: 'Z',
    charset: 'utf8mb4_unicode_ci',
    entities: [
        'src/entity/**/*.ts'
    ],
    migrations: [
        'src/migration/**/*.ts'
    ],
    subscribers: [
        'src/subscriber/**/*.ts'
    ],
    namingStrategy: new SnakeNamingStrategy(),
}

export default ORMConfig
