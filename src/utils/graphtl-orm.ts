import { createConnection, Connection, ConnectionOptions } from 'typeorm'
import ORMConfig from '../../ormconfig'

class GraphTLORM {
    private constructor() { }
    private static $store: Connection | undefined
    public static async initialize(): Promise<Array<Connection>> {
        const config: ConnectionOptions = {
            ...ORMConfig,
        }
        if (GraphTLORM.$store === undefined) {
            GraphTLORM.$store = await createConnection(config)
        }
        return [GraphTLORM.$store]
    }
    public static get client(): Connection {
        if (GraphTLORM.$store === undefined) {
            throw new Error('データベースに接続されていません')
        }
        return GraphTLORM.$store
    }
}

export default GraphTLORM
