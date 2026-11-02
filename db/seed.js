const { hashPassword } = require('../src/passwords');

const users = [
  { user_id: 'tony', name: 'Tony Stark', password: 'IronMan312!' },
  { user_id: 'steve', name: 'Steve Rogers', password: 'CaptainAmerica312!' },
  { user_id: 'peter', name: 'Peter Parker', password: 'SpiderMan312!' },
];

const blogs = [
  ['tony', 'Upgrading the Iron Man suit', 'The latest suit upgrade focuses on faster flight controls and a stronger energy shield. Every prototype gets a full diagnostic before I take it into the field. Even Iron Man needs to test his work before calling it finished.', '2026-09-01 08:30:00', ['iron-man', 'technology']],
  ['steve', 'Training for the next Avengers mission', 'I start each morning with a run, shield practice, and a briefing with the team. Being prepared means knowing your own strengths and trusting the people beside you. The best training builds teamwork as well as endurance.', '2026-09-03 14:00:00', ['captain-america', 'training']],
  ['peter', 'Balancing homework and neighborhood patrols', 'Some days the hardest part of being Spider-Man is finishing homework before patrol. I keep extra web cartridges in my backpack and try to help people on the way home. Being a friendly neighborhood hero starts with the small things.', '2026-09-05 07:15:00', ['spider-man', 'school']],
  ['tony', 'Clean energy starts with a better arc reactor', 'The arc reactor powers my armor, but its bigger promise is clean energy. I spent the weekend testing a smaller design that produces less heat without losing output. A useful invention should help more people than the person who built it.', '2026-09-07 18:45:00', ['iron-man', 'science']],
  ['steve', 'Why the Avengers work best as a team', 'Our team brings together people with very different skills and opinions. We succeed when we listen, make a plan, and look out for each other. A shield can stop a hit, but trust is what keeps the Avengers standing together.', '2026-09-09 16:20:00', ['captain-america', 'avengers']],
];

async function seedDatabase(client) {
  for (const user of users) {
    await client.query(
      'INSERT INTO users (user_id, password, name) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING',
      [user.user_id, await hashPassword(user.password), user.name],
    );
  }

  for (const [userId, title, body, createdAt, tags] of blogs) {
    await client.query(
      `INSERT INTO blogs (creator_name, creator_user_id, title, body, date_created, tags)
       SELECT name, user_id, $2::varchar, $3::text, $4::timestamp, $5::text[] FROM users
       WHERE user_id = $1 AND NOT EXISTS (
         SELECT 1 FROM blogs WHERE creator_user_id = $1 AND title = $2
       )`,
      [userId, title, body, createdAt, tags],
    );
  }
}

module.exports = { seedDatabase };
