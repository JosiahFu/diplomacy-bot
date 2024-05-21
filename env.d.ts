export {} 

declare global {
    namespace NodeJS {
        interface ProcessEnv {
            readonly BOT_TOKEN: string;
            readonly APPLICATION_ID: string;
            readonly OUTPUT_CHANNEL_ID: string;
        }
    }
}
