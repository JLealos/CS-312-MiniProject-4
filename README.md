# CS 312 Mini Project 1

A locally run blog web application built with Node.js, Express.js, and EJS.

## Project roadmap

1. Set up the project and dependencies.
2. Add the Express server and initial routes.
3. Create the EJS layout and blog pages.
4. Add in-memory post creation, viewing, editing, and deletion.
5. Add tags, filtering, sorting, and post reactions.
6. Add responsive styling.
7. Test the application across the main user workflows.

## Development commands

```text
npm run dev
npm start
```

Posts will be stored in server memory while the application is running. Restarting the server will reset them.

## Mini Project 3

Added PostgreSQL storage, signup/signin, hashed passwords, persistent sessions, and owner-only post editing/deletion. Tags, sorting, pagination, and reactions are preserved. Posts now persist after restarting.

Install PostgreSQL and run `npm install`. Create `.env` with the following values, replacing the password and session secret, then run `npm run db:setup` and `npm start`. Open http://localhost:3000.

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/BlogDB
SESSION_SECRET=your-long-random-secret
PORT=3000
```

Demo logins: `tony` / `IronMan312!`, `steve` / `CaptainAmerica312!`, and `peter` / `SpiderMan312!`. Reactions are saved per user: one like or dislike per post; click the selected reaction to remove it. The five starter posts are themed around the Marvel characters. Setup can be rerun without duplicating seed entries.

## Mini Project 4

Replaced the EJS frontend with React. Express now provides JSON API endpoints, and React uses fetch to load and update data without full-page reloads.

- React signup and signin components connected to backend authentication.
- Controlled fields in `BlogPostForm.js` for creating posts and editing prefilled posts.
- `PostList.js` fetches posts and renders them using `.map()`, with dynamic viewing, editing, and deletion.
- My Profile shows the signed-in user's posts, username, name, age, occupation, and city.
- Optional age, occupation, and city fields during signup, plus an editable profile for existing users.
- Preserved PostgreSQL storage, hashed passwords, sessions, CSRF protection, owner-only editing/deletion, tags, sorting, pagination, reactions, and responsive styling.

Run `npm run db:setup` to add the profile fields to an existing database, then `npm run build` and `npm start`. For frontend development, run `npm run dev` and `npm run dev:client` in separate terminals.
