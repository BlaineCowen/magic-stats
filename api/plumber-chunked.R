#* @apiTitle NFL Stats API (Chunked Version)
#* @apiDescription API for NFL statistics using chunked processing for large datasets

# Cache directory
cache_dir <- "/app/cache"
dir.create(cache_dir, showWarnings = FALSE, recursive = TRUE)

# Set cache directory for nflreadr
options(nflreadr.cache = "filesystem")

# Helper function to get current season
get_current_season <- function() {
    as.numeric(format(Sys.Date(), "%Y")) - 1
}

# Function to load data in chunks
load_pbp_chunked <- function(seasons) {
    all_data <- list()

    for (season in seasons) {
        cat("Loading season", season, "...\n")
        season_data <- load_pbp(season)
        all_data[[as.character(season)]] <- season_data

        # Force garbage collection after each season
        gc()
    }

    # Combine all seasons
    cat("Combining", length(seasons), "seasons...\n")
    combined_data <- do.call(rbind, all_data)

    # Clear individual season data
    rm(all_data)
    gc()

    return(combined_data)
}

#* Execute custom R code with chunked processing
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

            # Replace load_pbp with chunked version
            code_modified <- gsub(
                "load_pbp\\(([^)]+)\\)",
                "load_pbp_chunked(\\1)",
                code
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
        current_season = get_current_season(),
        memory_usage = paste(round(memory.size() / 1024^2, 2), "MB")
    )
}
