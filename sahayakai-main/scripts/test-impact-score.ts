import { calculateHealthScore } from '../src/lib/analytics/impact-score';

const profiles = {
    // 1. Core target: A healthy, growing teacher utilizing multiple features
    power_user: {
        user_id: "test_power_user",
        sessions_last_7_days: 12,
        sessions_days_8_to_14: 10,
        content_created_last_7_days: 15,
        content_created_days_8_to_14: 14,
        features_used_last_30_days: ["lesson-plan", "quiz", "worksheet", "instant-answer", "visual-aid"],
        avg_generation_time_sec: 12,
        avg_regenerations_per_content: 1.1,
        successful_generations: 140,
        total_attempts: 145,
        days_since_last_use: 0,
        consecutive_days_used: 14,
        days_since_signup: 45,
        content_created_total: 60,
        exported_content_count: 55,
        shared_to_community_count: 5,
        community_library_visits: 10,
        estimated_students: 45,
        location_type: "rural" as const,
        preferred_language: "hi"
    },
    // 2. The "Entropy Trap": Uses only one feature but uses it heavily
    entropy_trap: {
        user_id: "test_entropy",
        sessions_last_7_days: 10,
        sessions_days_8_to_14: 10,
        content_created_last_7_days: 20,
        content_created_days_8_to_14: 20,
        features_used_last_30_days: ["quiz"], // Only 1 feature
        avg_generation_time_sec: 5,
        avg_regenerations_per_content: 1.0,
        successful_generations: 200,
        total_attempts: 200,
        days_since_last_use: 1,
        consecutive_days_used: 5,
        days_since_signup: 60,
        content_created_total: 100,
        exported_content_count: 90,
        shared_to_community_count: 0,
        community_library_visits: 0,
        estimated_students: 40,
        location_type: "urban" as const,
        preferred_language: "en"
    },
    // 3. Prompt Thrashing: High failure rate, high regenerations
    prompt_thrasher: {
        user_id: "test_thrasher",
        sessions_last_7_days: 5,
        sessions_days_8_to_14: 2,
        content_created_last_7_days: 8,
        content_created_days_8_to_14: 2,
        features_used_last_30_days: ["lesson-plan", "quiz"],
        avg_generation_time_sec: 45,
        avg_regenerations_per_content: 3.5, // High thrashing
        successful_generations: 10,
        total_attempts: 40, // High failure/abandonment
        days_since_last_use: 0,
        consecutive_days_used: 2,
        days_since_signup: 15,
        content_created_total: 10,
        exported_content_count: 5,
        shared_to_community_count: 0,
        community_library_visits: 1,
        estimated_students: 30,
        location_type: "rural" as const,
        preferred_language: "hi"
    },
    // 4. Ghosted: Hasn't used it recently
    ghosted: {
        user_id: "test_ghost",
        sessions_last_7_days: 0,
        sessions_days_8_to_14: 5,
        content_created_last_7_days: 0,
        content_created_days_8_to_14: 10,
        features_used_last_30_days: ["lesson-plan"],
        avg_generation_time_sec: 15,
        avg_regenerations_per_content: 1.5,
        successful_generations: 15,
        total_attempts: 18,
        days_since_last_use: 8, // High recency decay penalty
        consecutive_days_used: 0,
        days_since_signup: 30,
        content_created_total: 15,
        exported_content_count: 10,
        shared_to_community_count: 0,
        community_library_visits: 0,
        estimated_students: 50,
        location_type: "rural" as const,
        preferred_language: "te"
    }
};

console.log("=========================================");
console.log("   SahayakAI Impact Score API Testing   ");
console.log("=========================================\n");

for (const [profileName, data] of Object.entries(profiles)) {
    console.log(`Testing Profile: [${profileName.toUpperCase()}]`);
    const result = calculateHealthScore(data);

    console.log(`  Overall Score:     ${result.score}%`);
    console.log(`  Risk Level:        ${result.risk_level.toUpperCase()}`);
    console.log(`  -----------------------------------------`);
    console.log(`  Dim A (Activity):  ${result.activity_score} / 30`);
    console.log(`  Dim E (Entropy):   ${result.engagement_score} / 30`);
    console.log(`  Dim S (Success):   ${result.success_score} / 20`);
    console.log(`  Dim G (Growth):    ${result.growth_score} / 20`);
    console.log(`  Dim C (Community): ${result.community_score} / 20`);
    console.log(`\n`);

    if (result.score < 0 || result.score > 100) {
        throw new Error(`CRITICAL ALARM: Score bounds violated for ${profileName}: ${result.score}`);
    }
}

console.log("All tests passed. Score calculation is strictly bounded to [0, 100].");
