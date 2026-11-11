import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(scrypt);

export const fixtureAccounts = [
  { id: "spike-alice", username: "spike.alice", displayName: "Spike Alice", password: "synthetic-alice-only" },
  { id: "spike-bob", username: "spike.bob", displayName: "Spike Bob", password: "synthetic-bob-only" },
];

export async function seedFixtures(database) {
  const accounts = await Promise.all(fixtureAccounts.map(async (account) => {
    const salt = randomBytes(16).toString("hex");
    const hash = (await derive(account.password, salt, 64)).toString("hex");
    return { ...account, salt, hash };
  }));
  await database.transaction(async (client) => {
    for (const account of accounts) {
      const inserted = await client.query(`
        INSERT INTO users(id, username, display_name, password_salt, password_hash)
        VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING RETURNING id
      `, [account.id, account.username, account.displayName, account.salt, account.hash]);
      if (inserted.rowCount) {
        await client.query("INSERT INTO artists(id, user_id, name) VALUES ($1, $2, $3)",
          [`artist-${account.id}`, account.id, account.displayName]);
      }
    }
    await client.query(`
      INSERT INTO fixture_dubs(id, owner_id, title, distribution) VALUES
        ('spike-public', 'spike-alice', 'Synthetic public track', 'worldwide'),
        ('spike-alice-private', 'spike-alice', 'Synthetic Alice track', 'private'),
        ('spike-bob-private', 'spike-bob', 'Synthetic Bob track', 'private')
      ON CONFLICT (id) DO NOTHING
    `);
  });
}
