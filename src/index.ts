import 'reflect-metadata'
import { connectSearchStream } from './utils/twitter'
import { Schemas } from './utils/client-generated'
import { Tweet } from './entity/Tweet'
import { User } from './entity/User'
import GraphTLORM from './utils/graphtl-orm'
import { parse, stringify } from 'json-bigint'

(async () => {
    await GraphTLORM.initialize()
    try {
        const stream = await connectSearchStream({
            parameter: {
                'media.fields': ['duration_ms', 'height', 'media_key', 'preview_image_url', 'type', 'url', 'width', 'public_metrics'],
                'place.fields': ['contained_within', 'country', 'country_code', 'full_name', 'geo', 'id', 'name', 'place_type'],
                'poll.fields': undefined,
                'tweet.fields': ['attachments', 'author_id', 'context_annotations', 'conversation_id', 'created_at', 'entities', 'geo', 'id', 'in_reply_to_user_id', 'lang', 'public_metrics', 'possibly_sensitive', 'referenced_tweets', 'source', 'text', 'withheld'],
                'user.fields': ['created_at', 'description', 'entities', 'id', 'location', 'name', 'pinned_tweet_id', 'profile_image_url', 'protected', 'public_metrics', 'url', 'username', 'verified', 'withheld'],
                'expansions': ['attachments.poll_ids', 'attachments.media_keys', 'author_id', 'entities.mentions.username', 'geo.place_id', 'in_reply_to_user_id', 'referenced_tweets.id', 'referenced_tweets.id.author_id'],
            }
        })
        stream.on('data', async (chunk: Buffer) => {
            // Keep alive signal < Buffer 0d 0a > received.Do nothing.
            if (chunk.length > 2) {
                const chunks: Buffer[] = []
                chunks.push(chunk)
                try {
                    const tweet: Schemas.SingleTweetLookupResponse = parse(Buffer.concat(chunks).toString())
                    const user = tweet.includes.users[0]
                    process.env.NODE_ENV === 'development' && console.log(JSON.stringify(tweet, null, 2))
                    try {
                        await User.findOneOrFail({ id_str: user.id })
                    } catch (_error) {
                        await User.create({
                            id_str: user.id,
                            username: user.username,
                            data: stringify(user),
                            created_at: user.created_at
                        }).save()
                    }
                    await Tweet.create({
                        id_str: tweet.data.id,
                        user_id_str: user.id,
                        text: tweet.data.text,
                        data: stringify(tweet),
                        created_at: tweet.data.created_at
                    }).save()
                } catch (error) {
                    (error instanceof SyntaxError) || console.error(error)
                }
            }
        })
    } catch (error) {
        console.error(error)
    }
})()
