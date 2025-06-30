# NFL Stats API Deployment Guide

This API uses `nflreadr` from the nflverse universe, which is much lighter than `nflfastR` and should work well on smaller VPS instances.

## Prerequisites

- Ubuntu/Debian VPS (1GB RAM minimum, 2GB recommended)
- Docker and Docker Compose installed
- Port 8000 available

## Installation

1. **Clone the repository and navigate to the API directory:**
   ```bash
   cd api
   ```

2. **Build and start the API:**
   ```bash
   docker-compose up -d --build
   ```

3. **Check the logs:**
   ```bash
   docker-compose logs -f
   ```

## API Endpoints

- `GET /health` - Health check
- `GET /cache-info` - Cache information
- `GET /players?name=Player Name` - Search players
- `GET /player-stats?player_id=ID&season=2024` - Player statistics
- `GET /team-stats?team=DAL&season=2024` - Team statistics
- `GET /leaders?stat=passing_yards&season=2024&limit=20` - Statistical leaders
- `GET /game-stats?season=2024&week=1` - Game schedules
- `POST /query` - Simple query parser

## Configuration

The API uses nflreadr's built-in caching system. Data is cached in `/app/cache` and persisted via Docker volume.

## Troubleshooting

### Package Installation Issues
If you encounter package installation problems:

1. **Check available memory:**
   ```bash
   free -h
   ```

2. **Clear Docker cache:**
   ```bash
   docker system prune -a
   ```

3. **Rebuild without cache:**
   ```bash
   docker-compose build --no-cache
   ```

### Memory Issues
If the VPS runs out of memory during installation:

1. **Add swap space:**
   ```bash
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

2. **Make swap permanent:**
   ```bash
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

## Performance Notes

- nflreadr is much lighter than nflfastR
- Data is cached locally and reused
- First request for each dataset may be slow
- Subsequent requests will be fast due to caching

## Monitoring

Check API health:
```bash
curl http://localhost:8000/health
```

Check cache status:
```bash
curl http://localhost:8000/cache-info
``` 