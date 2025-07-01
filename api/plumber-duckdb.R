#* @apiTitle NFL Stats API (DuckDB Version)
#* @apiDescription API for NFL statistics using nflreadr + DuckDB for large dataset queries

# Load required libraries
library(plumber)
library(dplyr)
library(nflreadr)
library(DBI)
library(duckdb)

# Cache directory
cache_dir <- "/app/cache"
dir.create(cache_dir, showWarnings = FALSE, recursive = TRUE)

# Set cache directory for nflreadr
options(nflreadr.cache = "filesystem")

# DuckDB database path
db_path <- file.path(cache_dir, "nfl_data.duckdb")

# Helper function to get current season
get_current_season <- function() {
    as.numeric(format(Sys.Date(), "%Y")) - 1
}

# Initialize database
init_database <- function() {
    if (!file.exists(db_path)) {
        cat("Creating DuckDB database...\n")
        con <- DBI::dbConnect(duckdb::duckdb(), db_path)

        # Load and store recent years of data (2023-2024 for 2GB VPS)
        cat("Loading 2023-2024 data into database...\n")

        # Load data year by year to avoid memory issues
        for (year in 2023:2024) {
            cat("Loading", year, "data...\n")

            # Load player stats
            player_stats <- load_player_stats(year)
            table_name_stats <- paste0("player_stats_", year)
            DBI::dbWriteTable(con, table_name_stats, player_stats, overwrite = TRUE)
            rm(player_stats)
            gc()

            # Load play-by-play (only for 2024 to save space)
            if (year == 2024) {
                pbp <- load_pbp(year)
                table_name_pbp <- paste0("pbp_", year)
                DBI::dbWriteTable(con, table_name_pbp, pbp, overwrite = TRUE)
                rm(pbp)
                gc()
            }

            # Load rosters
            rosters <- load_rosters(year)
            table_name_rosters <- paste0("rosters_", year)
            DBI::dbWriteTable(con, table_name_rosters, rosters, overwrite = TRUE)
            rm(rosters)
            gc()

            # Load schedules
            schedules <- load_schedules(year)
            table_name_schedules <- paste0("schedules_", year)
            DBI::dbWriteTable(con, table_name_schedules, schedules, overwrite = TRUE)
            rm(schedules)
            gc()
        }

        DBI::dbDisconnect(con, shutdown = TRUE)
        cat("Database initialized successfully\n")
    }
}

#* Execute custom R code with DuckDB optimization
#* @param code R code to execute
#* @post /execute
function(req) {
    tryCatch(
        {
            # Parse the R code from request
            code <- req$body$code

            if (is.null(code)) {
                return(list(error = "No code provided"))
            }

            cat("Executing code:", code, "\n")

            # Initialize database if needed
            init_database()

            # Connect to database
            con <- DBI::dbConnect(duckdb::duckdb(), db_path)

            # Replace load functions with DuckDB versions
            code_modified <- code

            # Replace load_player_stats with DuckDB version
            code_modified <- gsub(
                "load_player_stats\\(season = ([^)]+)\\)",
                "DBI::dbGetQuery(con, 'SELECT * FROM player_stats_\\1')",
                code_modified
            )

            # Replace load_pbp with DuckDB version
            code_modified <- gsub(
                "load_pbp\\(([^)]+)\\)",
                "DBI::dbGetQuery(con, 'SELECT * FROM pbp_\\1')",
                code_modified
            )

            # Replace load_rosters with DuckDB version
            code_modified <- gsub(
                "load_rosters\\(([^)]+)\\)",
                "DBI::dbGetQuery(con, 'SELECT * FROM rosters_\\1')",
                code_modified
            )

            # Replace load_schedules with DuckDB version
            code_modified <- gsub(
                "load_schedules\\(([^)]+)\\)",
                "DBI::dbGetQuery(con, 'SELECT * FROM schedules_\\1')",
                code_modified
            )

            # Execute the code and capture the result
            result <- eval(parse(text = code_modified))

            # Disconnect from database
            DBI::dbDisconnect(con, shutdown = TRUE)

            # Convert to list for JSON serialization
            if (is.data.frame(result)) {
                result_list <- as.list(result)
            } else {
                result_list <- result
            }

            # Force garbage collection
            gc()

            return(list(result = result_list))
        },
        error = function(e) {
            return(list(error = e$message))
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
        db_path = db_path,
        db_exists = file.exists(db_path),
        current_season = get_current_season(),
        memory_usage = paste(round(memory.size() / 1024^2, 2), "MB")
    )
}
