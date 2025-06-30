SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'; 

-- Count plays by season
SELECT season, COUNT(*) as play_count
FROM "Game"
GROUP BY season
ORDER BY season;

-- Count total plays
SELECT COUNT(*) as total_plays
FROM "Play";

-- Sample of games from each season
SELECT DISTINCT ON (season) 
  id, season, week, gameType, homeTeam, awayTeam, homeScore, awayScore
FROM "Game"
ORDER BY season, id; 