library(plumber)
library(data.table)
library(dplyr)
library(nflreadr)

# Memory-optimized nflfastR API for 2GB VPS
# Loads data on-demand and clears memory aggressively

# Global cache for small datasets
roster_cache <- list()
schedule_cache <- list()

# Memory management function
clear_memory <- function() {
    gc()
    Sys.sleep(0.1) # Give GC time to work
}

# Load player stats with memory optimization
load_player_stats_optimized <- function(season, week = NULL, team = NULL, player = NULL) {
    clear_memory()

    # Load only requested season
    cat("Loading player stats for season:", season, "\n")
    stats <- nflreadr::load_player_stats(season = season)

    # Apply filters early to reduce memory usage
    if (!is.null(week)) {
        stats <- stats %>% filter(week == week)
    }
    if (!is.null(team)) {
        stats <- stats %>% filter(recent_team == team)
    }
    if (!is.null(player)) {
        stats <- stats %>% filter(grepl(player, player_name, ignore.case = TRUE))
    }

    clear_memory()
    return(stats)
}

# Load play-by-play with memory optimization
load_pbp_optimized <- function(season, week = NULL, team = NULL, player_id = NULL) {
    clear_memory()

    cat("Loading play-by-play for season:", season, "\n")
    pbp <- nflreadr::load_pbp(season = season)

    # Apply filters early
    if (!is.null(week)) {
        pbp <- pbp %>% filter(week == week)
    }
    if (!is.null(team)) {
        pbp <- pbp %>% filter(posteam == team | defteam == team)
    }
    if (!is.null(player_id)) {
        pbp <- pbp %>% filter(
            passer_player_id == player_id |
                receiver_player_id == player_id |
                rusher_player_id == player_id
        )
    }

    clear_memory()
    return(pbp)
}

# Load roster with caching
load_roster_optimized <- function(season) {
    if (is.null(roster_cache[[as.character(season)]])) {
        cat("Loading roster for season:", season, "\n")
        roster_cache[[as.character(season)]] <<- nflreadr::load_rosters(season = season)
        clear_memory()
    }
    return(roster_cache[[as.character(season)]])
}

# Load schedule with caching
load_schedule_optimized <- function(season) {
    if (is.null(schedule_cache[[as.character(season)]])) {
        cat("Loading schedule for season:", season, "\n")
        schedule_cache[[as.character(season)]] <<- nflreadr::load_schedules(season = season)
        clear_memory()
    }
    return(schedule_cache[[as.character(season)]])
}

#* @get /health
#* @serializer json
function() {
    list(status = "healthy", memory = paste0(round(memory.size() / 1024, 2), " MB"))
}

#* @get /cache-info
#* @serializer json
function() {
    list(
        roster_cache_size = length(roster_cache),
        schedule_cache_size = length(schedule_cache),
        memory_usage = paste0(round(memory.size() / 1024, 2), " MB")
    )
}

#* @post /execute
#* @serializer json
function(req) {
    tryCatch(
        {
            # Parse the R code from request
            code <- req$body$code

            if (is.null(code)) {
                return(list(error = "No code provided"))
            }

            cat("Executing code:", code, "\n")

            # Execute the code
            result <- eval(parse(text = code))

            # Clear memory after execution
            clear_memory()

            # Convert to list if it's a data frame
            if (is.data.frame(result)) {
                result <- as.list(result)
            }

            return(list(result = result))
        },
        error = function(e) {
            clear_memory()
            return(list(error = e$message))
        }
    )
}

#* @get /players
#* @param season:int The NFL season
#* @param team:string The team abbreviation (optional)
#* @param position:string The position (optional)
#* @serializer json
function(season = 2024, team = NULL, position = NULL) {
    tryCatch(
        {
            roster <- load_roster_optimized(season)

            if (!is.null(team)) {
                roster <- roster %>% filter(team == team)
            }
            if (!is.null(position)) {
                roster <- roster %>% filter(position == position)
            }

            # Limit results to prevent memory issues
            roster <- roster %>% head(100)

            clear_memory()
            return(as.list(roster))
        },
        error = function(e) {
            clear_memory()
            return(list(error = e$message))
        }
    )
}

#* @get /player-stats
#* @param season:int The NFL season
#* @param week:int The week number (optional)
#* @param team:string The team abbreviation (optional)
#* @param player:string Player name (optional)
#* @serializer json
function(season = 2024, week = NULL, team = NULL, player = NULL) {
    tryCatch(
        {
            stats <- load_player_stats_optimized(season, week, team, player)

            # Limit results
            stats <- stats %>% head(100)

            clear_memory()
            return(as.list(stats))
        },
        error = function(e) {
            clear_memory()
            return(list(error = e$message))
        }
    )
}

#* @get /team-stats
#* @param season:int The NFL season
#* @param team:string The team abbreviation
#* @serializer json
function(season = 2024, team) {
    tryCatch(
        {
            stats <- load_player_stats_optimized(season, team = team)

            # Aggregate by team
            team_stats <- stats %>%
                group_by(recent_team) %>%
                summarise(
                    total_passing_yards = sum(passing_yards, na.rm = TRUE),
                    total_rushing_yards = sum(rushing_yards, na.rm = TRUE),
                    total_receiving_yards = sum(receiving_yards, na.rm = TRUE),
                    total_touchdowns = sum(passing_tds + rushing_tds + receiving_tds, na.rm = TRUE),
                    total_sacks = sum(sacks, na.rm = TRUE),
                    .groups = "drop"
                )

            clear_memory()
            return(as.list(team_stats))
        },
        error = function(e) {
            clear_memory()
            return(list(error = e$message))
        }
    )
}

#* @get /leaders
#* @param season:int The NFL season
#* @param stat:string The stat to rank by (passing_yards, rushing_yards, etc.)
#* @param position:string The position (optional)
#* @param min_attempts:int Minimum attempts filter (optional)
#* @serializer json
function(season = 2024, stat, position = NULL, min_attempts = NULL) {
    tryCatch(
        {
            stats <- load_player_stats_optimized(season)

            # Filter by position if specified
            if (!is.null(position)) {
                # Need to join with roster to get position
                roster <- load_roster_optimized(season)
                stats <- stats %>%
                    left_join(roster %>% select(gsis_id, position), by = c("player_id" = "gsis_id")) %>%
                    filter(position == position)
            }

            # Group by player and get season totals
            leaders <- stats %>%
                group_by(player_name, recent_team) %>%
                summarise(
                    total_stat = sum(!!sym(stat), na.rm = TRUE),
                    total_attempts = sum(attempts, na.rm = TRUE),
                    .groups = "drop"
                )

            # Apply minimum attempts filter
            if (!is.null(min_attempts)) {
                leaders <- leaders %>% filter(total_attempts >= min_attempts)
            }

            # Sort and limit
            leaders <- leaders %>%
                arrange(desc(total_stat)) %>%
                head(20)

            clear_memory()
            return(as.list(leaders))
        },
        error = function(e) {
            clear_memory()
            return(list(error = e$message))
        }
    )
}

#* @get /game-stats
#* @param season:int The NFL season
#* @param week:int The week number (optional)
#* @param team:string The team abbreviation (optional)
#* @serializer json
function(season = 2024, week = NULL, team = NULL) {
    tryCatch(
        {
            schedule <- load_schedule_optimized(season)

            if (!is.null(week)) {
                schedule <- schedule %>% filter(week == week)
            }
            if (!is.null(team)) {
                schedule <- schedule %>% filter(home_team == team | away_team == team)
            }

            # Limit results
            schedule <- schedule %>% head(50)

            clear_memory()
            return(as.list(schedule))
        },
        error = function(e) {
            clear_memory()
            return(list(error = e$message))
        }
    )
}

#* @get /clear-cache
#* @serializer json
function() {
    roster_cache <<- list()
    schedule_cache <<- list()
    clear_memory()
    return(list(message = "Cache cleared"))
}

# Start the API
cat("Starting memory-optimized NFL API...\n")
cat("Memory usage:", round(memory.size() / 1024, 2), "MB\n")
