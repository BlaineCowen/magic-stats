#* @apiTitle NFL Stats API (SQLite Version)
#* @apiDescription API for NFL statistics using nflreadr + SQLite for memory-efficient queries

# Cache directory
cache_dir <- "/app/cache"
dir.create(cache_dir, showWarnings = FALSE, recursive = TRUE)

# Set cache directory for nflreadr
options(nflreadr.cache = "filesystem")

# SQLite database path
db_path <- file.path(cache_dir, "nfl_data.db")

# Helper function to get current season
get_current_season <- function() {
    as.numeric(format(Sys.Date(), "%Y")) - 1
}

# Initialize database
init_database <- function() {
    if (!file.exists(db_path)) {
        cat("Creating SQLite database...\n")
        con <- DBI::dbConnect(RSQLite::SQLite(), db_path)

        # Load and store current season data
        cat("Loading 2023 data into database...\n")
        pbp_2023 <- load_pbp(2023)
        rosters_2023 <- load_rosters(2023)

        DBI::dbWriteTable(con, "pbp_2023", pbp_2023, overwrite = TRUE)
        DBI::dbWriteTable(con, "rosters_2023", rosters_2023, overwrite = TRUE)

        DBI::dbDisconnect(con)
        cat("Database initialized successfully\n")
    }
}

#* Execute custom R code with SQLite optimization
#* @param code R code to execute
#* @post /execute
function(req, code = "") {
    tryCatch(
        {
            if (code == "") {
                return(list(error = "R code is required"))
            }

            # Load required libraries
            library(dplyr)
            library(nflreadr)
            library(DBI)
            library(RSQLite)

            # Initialize database if needed
            init_database()

            # Replace load_pbp with SQLite version
            code_modified <- gsub(
                "load_pbp\\(([^)]+)\\)",
                "DBI::dbGetQuery(DBI::dbConnect(RSQLite::SQLite(), db_path), 'SELECT * FROM pbp_2023')",
                code
            )

            # Replace load_rosters with SQLite version
            code_modified <- gsub(
                "load_rosters\\(([^)]+)\\)",
                "DBI::dbGetQuery(DBI::dbConnect(RSQLite::SQLite(), db_path), 'SELECT * FROM rosters_2023')",
                code_modified
            )

            # Execute the code and capture the result
            result <- eval(parse(text = code_modified))

            # Convert to list for JSON serialization
            if (is.data.frame(result)) {
                result_list <- as.list(result)
                attr(result_list, "column_names") <- names(result)
                attr(result_list, "row_count") <- nrow(result)
            } else {
                result_list <- result
            }

            # Force garbage collection
            gc()

            list(
                success = TRUE,
                result = result_list,
                code_executed = code_modified
            )
        },
        error = function(e) {
            list(
                success = FALSE,
                error = e$message,
                code_executed = code
            )
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
