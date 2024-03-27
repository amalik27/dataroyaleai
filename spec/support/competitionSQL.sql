-- Data needed for competition controller test cases to run smoothly. Please run the following commands:
INSERT INTO competitions (id, userid, title, deadline, prize, metrics, description, player_cap, date_created, inputs_outputs, file_path)
VALUES (42161251, 123456, "Competition A", "2024-05-06", 120, json_object("size", 3, "speed", 1, "accuracy", 5), "A sample Competition", 120, "2024-03-20", json_object("inputs", "images", "outputs", "name"), "./backend/controllers/goodcat.zip");

INSERT INTO competitions (id, userid, title, deadline, prize, metrics, description, player_cap, date_created, inputs_outputs, file_path)
VALUES (71393633, 123456, "Competition B", "2024-06-06", 120, json_object("size", 3, "speed", 1, "accuracy", 5), "A sample Competition", 120, "2024-03-20", json_object("inputs", "images", "outputs", "name"), "./backend/controllers/goodcat.zip");

INSERT INTO users (id, username, email, salt, password_encrypted, role, tier, credits, reg_date, api_token) 
VALUES (68, "Other Organizer", "wow@gmail.com", "salt", "password", "Organizer", 1, 200, "2024-03-21", "token");

INSERT INTO users (id, username, email, salt, password_encrypted, role, tier, credits, reg_date, api_token) 
VALUES (123456, "TestOrganizer", "organizer@gmail.com", "salt", "password", "Organizer", 1, 150, "2024-03-20", "token");

INSERT INTO users (id, username, email, salt, password_encrypted, role, tier, credits, reg_date, api_token) 
VALUES (129834, "Sample Competitor", "competitor@gmail.com", "salt", "password", "Competitor", 2, 100, "2024-03-21", "token");

