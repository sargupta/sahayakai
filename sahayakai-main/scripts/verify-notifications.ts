
import { getNotificationsAction } from "../src/app/actions/notifications";
import { getDb } from "../src/lib/firebase-admin";
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function verifyNotifications() {
    console.log("--- Verifying Notification Query ---");
    try {
        const notifications = await getNotificationsAction('dev-user');
        console.log(`✅ SUCCESS: Fetched ${notifications.length} notifications without index error.`);
    } catch (error) {
        console.error("❌ FAILURE: Notification query crashed.", error);
    }
}

verifyNotifications().catch(console.error);
