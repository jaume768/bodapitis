#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Wedding Gallery Django Application...${NC}"

# Function to wait for database
wait_for_db() {
    echo -e "${YELLOW}Waiting for MySQL database to be ready...${NC}"
    
    while ! nc -z $DB_HOST $DB_PORT; do
        echo "Database is unavailable - sleeping"
        sleep 2
    done
    
    echo -e "${GREEN}Database is ready!${NC}"
    sleep 2
}

# Function to create superuser
create_superuser() {
    if [ "$DJANGO_SUPERUSER_USERNAME" ] && [ "$DJANGO_SUPERUSER_PASSWORD" ] && [ "$DJANGO_SUPERUSER_EMAIL" ]; then
        echo -e "${YELLOW}Creating Django superuser...${NC}"
        python manage.py createsuperuser --noinput || true
        echo -e "${GREEN}Superuser created or already exists.${NC}"
    fi
}

# Wait for database
wait_for_db

# Apply database migrations
echo -e "${YELLOW}Applying database migrations...${NC}"
python manage.py makemigrations
python manage.py migrate

# Collect static files
echo -e "${YELLOW}Collecting static files...${NC}"
python manage.py collectstatic --noinput

# Create superuser if environment variables are provided
create_superuser

echo -e "${GREEN}Setup completed! Starting Django server...${NC}"

# Execute the main command
exec "$@"
