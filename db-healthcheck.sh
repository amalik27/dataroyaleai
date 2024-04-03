#!/bin/bash
# db-healthcheck.sh

# Replace these variables according to your environment
DB_HOST="localhost"
DB_PORT="3306"
DB_USER="root"
DB_PASSWORD="$MYSQL_ROOT_PASSWORD"
DB_NAME="swe2024" # Optional: Specify your database if needed for the query

# The SQL query
QUERY="SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '${DB_NAME}' AND table_name = 'users'"
# Attempt to run the query and capture the output
RESULT=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -D "$DB_NAME" -e "$QUERY" -s --skip-column-names)
# Check if the query was successful
if [ "$RESULT" == "1" ]; then
  echo "Database is ready."
  exit 0
else
  echo "Database is not ready."
  exit 1
fi

