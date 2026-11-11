import { seedFixtures } from "../stage-a/fixtures.mjs";

export async function seedMediaFixtures(database) {
  await seedFixtures(database);
  await database.transaction(async (client) => {
    await client.query("UPDATE users SET a_list_approved = true WHERE id = 'spike-alice'");
    await client.query(`
      INSERT INTO users(id, username, display_name, password_salt, password_hash, a_list_approved)
      SELECT 'spike-charlie', 'spike.charlie', 'Spike Charlie', password_salt, password_hash, false
      FROM users WHERE id = 'spike-bob' ON CONFLICT (id) DO NOTHING
    `);
    await client.query(`
      INSERT INTO users(id, username, display_name, password_salt, password_hash, a_list_approved)
      SELECT 'spike-dana', 'spike.dana', 'Spike Dana', password_salt, password_hash, true
      FROM users WHERE id = 'spike-alice' ON CONFLICT (id) DO NOTHING
    `);
    await client.query(`
      INSERT INTO media_friendships(owner_id, friend_id)
      VALUES ('spike-alice', 'spike-bob'), ('spike-bob', 'spike-alice')
      ON CONFLICT DO NOTHING
    `);
  });
}
