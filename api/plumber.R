#* @apiTitle NFL Stats API
#* @apiDescription API for NFL statistics using nflreadr data

# Cache directory
cache_dir <- "/app/cache"
dir.create(cache_dir, showWarnings = FALSE, recursive = TRUE)

# Set cache directory for nflreadr
options(nflreadr.cache = cache_dir)

#* Get cache information
#* @get /cache-info
function() {
    cache_size <- sum(file.size(list.files(cache_dir, full.names = TRUE, recursive = TRUE)))
    cache_files <- length(list.files(cache_dir, recursive = TRUE))

    list(
        cache_dir = cache_dir,
        cache_size_mb = round(cache_size / 1024 / 1024, 2),
        cache_files = cache_files
    )
}

#* Search for players
#* @param name Player name to search for
#* @get /players
function(name = "") {
    tryCatch(
        {
            # Load current season rosters
            rosters <- load_rosters(season = get_current_season())

            if (name != "") {
                # Filter by name (case insensitive)
                rosters <- rosters %>%
                    filter(grepl(name, display_name, ignore.case = TRUE) |
                        grepl(name, full_name, ignore.case = TRUE))
            }

            # Limit results and select key fields
            result <- rosters %>%
                head(50) %>%
                select(
                    gsis_id,
                    display_name,
                    position,
                    team,
                    jersey_number,
                    height,
                    weight,
                    college_name
                ) %>%
                rename(
                    gsisId = gsis_id,
                    displayName = display_name,
                    latestTeam = team,
                    jerseyNumber = jersey_number,
                    collegeName = college_name
                )

            list(players = result)
        },
        error = function(e) {
            list(error = e$message, players = list())
        }
    )
}

#* Get player stats
#* @param player_id Player GSIS ID
#* @param season Season year (default: current)
#* @param season_type Season type (REG, POST, PRE)
#* @get /player-stats
function(player_id = "", season = get_current_season(), season_type = "REG") {
    tryCatch(
        {
            if (player_id == "") {
                return(list(error = "Player ID required", stats = list()))
            }

            # Load player stats
            stats <- load_player_stats(season = season, season_type = season_type)

            # Filter by player
            player_stats <- stats %>%
                filter(player_id == !!player_id) %>%
                arrange(week) %>%
                select(
                    season,
                    week,
                    season_type,
                    team,
                    opponent,
                    completions,
                    attempts,
                    passing_yards,
                    passing_tds,
                    interceptions,
                    sacks,
                    carries,
                    rushing_yards,
                    rushing_tds,
                    receptions,
                    targets,
                    receiving_yards,
                    receiving_tds,
                    fantasy_points,
                    fantasy_points_ppr
                )

            list(stats = player_stats)
        },
        error = function(e) {
            list(error = e$message, stats = list())
        }
    )
}

#* Get team stats
#* @param team Team abbreviation
#* @param season Season year (default: current)
#* @get /team-stats
function(team = "", season = get_current_season()) {
    tryCatch(
        {
            if (team == "") {
                return(list(error = "Team required", stats = list()))
            }

            # Load player stats for the team
            stats <- load_player_stats(season = season)

            # Filter by team and aggregate
            team_stats <- stats %>%
                filter(team == !!team) %>%
                group_by(player_id, player_name, position) %>%
                summarise(
                    games = n(),
                    total_passing_yards = sum(passing_yards, na.rm = TRUE),
                    total_rushing_yards = sum(rushing_yards, na.rm = TRUE),
                    total_receiving_yards = sum(receiving_yards, na.rm = TRUE),
                    total_tds = sum(passing_tds + rushing_tds + receiving_tds, na.rm = TRUE),
                    total_fantasy_points = sum(fantasy_points, na.rm = TRUE),
                    .groups = "drop"
                ) %>%
                arrange(desc(total_fantasy_points))

            list(stats = team_stats)
        },
        error = function(e) {
            list(error = e$message, stats = list())
        }
    )
}

#* Get leaders
#* @param stat Statistic to rank by
#* @param season Season year (default: current)
#* @param limit Number of results (default: 20)
#* @get /leaders
function(stat = "passing_yards", season = get_current_season(), limit = 20) {
    tryCatch(
        {
            # Load player stats
            stats <- load_player_stats(season = season)

            # Determine which stat to rank by
            if (stat == "passing_yards") {
                leaders <- stats %>%
                    filter(!is.na(passing_yards) & passing_yards > 0) %>%
                    group_by(player_id, player_name, team) %>%
                    summarise(
                        yards = sum(passing_yards, na.rm = TRUE),
                        attempts = sum(attempts, na.rm = TRUE),
                        completions = sum(completions, na.rm = TRUE),
                        tds = sum(passing_tds, na.rm = TRUE),
                        ints = sum(interceptions, na.rm = TRUE),
                        .groups = "drop"
                    ) %>%
                    arrange(desc(yards)) %>%
                    head(limit)
            } else if (stat == "rushing_yards") {
                leaders <- stats %>%
                    filter(!is.na(rushing_yards) & rushing_yards > 0) %>%
                    group_by(player_id, player_name, team) %>%
                    summarise(
                        yards = sum(rushing_yards, na.rm = TRUE),
                        carries = sum(carries, na.rm = TRUE),
                        tds = sum(rushing_tds, na.rm = TRUE),
                        .groups = "drop"
                    ) %>%
                    arrange(desc(yards)) %>%
                    head(limit)
            } else if (stat == "receiving_yards") {
                leaders <- stats %>%
                    filter(!is.na(receiving_yards) & receiving_yards > 0) %>%
                    group_by(player_id, player_name, team) %>%
                    summarise(
                        yards = sum(receiving_yards, na.rm = TRUE),
                        receptions = sum(receptions, na.rm = TRUE),
                        targets = sum(targets, na.rm = TRUE),
                        tds = sum(receiving_tds, na.rm = TRUE),
                        .groups = "drop"
                    ) %>%
                    arrange(desc(yards)) %>%
                    head(limit)
            } else {
                return(list(error = "Invalid stat. Use: passing_yards, rushing_yards, receiving_yards", leaders = list()))
            }

            list(leaders = leaders)
        },
        error = function(e) {
            list(error = e$message, leaders = list())
        }
    )
}

#* Get game stats
#* @param season Season year (default: current)
#* @param week Week number (optional)
#* @param team Team abbreviation (optional)
#* @get /game-stats
function(season = get_current_season(), week = NULL, team = NULL) {
    tryCatch(
        {
            # Load schedules
            schedules <- load_schedules(season = season)

            # Apply filters
            if (!is.null(week)) {
                schedules <- schedules %>%
                    filter(week == !!week)
            }

            if (!is.null(team)) {
                schedules <- schedules %>%
                    filter(home_team == !!team | away_team == !!team)
            }

            # Select key fields
            result <- schedules %>%
                select(
                    game_id,
                    season,
                    week,
                    season_type,
                    home_team,
                    away_team,
                    home_score,
                    away_score,
                    game_date,
                    stadium,
                    weather
                ) %>%
                arrange(week, game_date)

            list(games = result)
        },
        error = function(e) {
            list(error = e$message, games = list())
        }
    )
}

#* Simple query parser
#* @param query Query string
#* @post /query
function(req, query = "") {
    tryCatch(
        {
            if (query == "") {
                return(list(message = "Please provide a query"))
            }

            # Simple keyword matching
            query_lower <- tolower(query)

            if (grepl("player|stats", query_lower)) {
                # Extract player name (simple pattern)
                player_match <- regmatches(query, regexpr("[A-Z][a-z]+ [A-Z][a-z]+", query))
                if (length(player_match) > 0) {
                    return(list(
                        message = paste("Searching for player:", player_match[1]),
                        query_type = "player_search",
                        player_name = player_match[1]
                    ))
                }
            }

            if (grepl("team|leaders|top", query_lower)) {
                return(list(
                    message = "This appears to be a team or leaders query",
                    query_type = "team_or_leaders"
                ))
            }

            return(list(
                message = "Query received. Try specific endpoints for better results.",
                query_type = "general"
            ))
        },
        error = function(e) {
            list(error = e$message)
        }
    )
}

#* Health check
#* @get /health
function() {
    list(
        status = "healthy",
        timestamp = Sys.time(),
        cache_dir = cache_dir,
        current_season = get_current_season()
    )
}
