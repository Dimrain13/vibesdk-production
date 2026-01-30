db = db.getSiblingDB('emergent_dev');

db.createCollection('users');
db.createCollection('user_contexts');
db.createCollection('projects');
db.createCollection('agent_history');

db.users.createIndex({ "email": 1 }, { unique: true });
db.user_contexts.createIndex({ "user_id": 1 }, { unique: true });
db.projects.createIndex({ "user_id": 1, "project_id": 1 });

print("MongoDB initialized!");
