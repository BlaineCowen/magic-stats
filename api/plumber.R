#* @apiTitle NFL Stats API
#* @apiDescription API for NFL statistics using nflreadr data

# Cache directory
cache_dir <- "/app/cache"
dir.create(cache_dir, showWarnings = FALSE, recursive = TRUE)

# Set cache directory for nflreadr
options(nflreadr.cache = "filesystem")
options(nflreadr.verbose = FALSE)

# Global variables to store cached data
cached_data <- list()
current_season <- as.numeric(format(Sys.Date(), "%Y")) - 1 # Use previous year since 2024 data isn't available yet

# Helper function to get current season
get_current_season <- function() {
    current_season
}

# Preload commonly used data on startup
cat("Preloading NFL data...\n")

# Load required libraries first
library(dplyr)
library(nflreadr)
library(memoise)
library(arrow)

# Memoize nflreadr functions for caching
load_player_stats <- memoise(load_player_stats)
load_rosters <- memoise(load_rosters)
load_schedules <- memoise(load_schedules)
load_pbp <- memoise(load_pbp)

# Preloading removed - data will be loaded on-demand with memoise caching
cat("NFL API ready - data will be loaded on-demand with caching\n")

# Function to load data with caching and memory management
load_data_with_cache <- function(data_type, season) {
    cache_key <- paste(data_type, season, sep = "_")

    if (is.null(cached_data[[cache_key]])) {
        cat("Loading", data_type, "for season", season, "...\n")

        tryCatch(
            {
                if (data_type == "pbp") {
                    # For play-by-play, load with memory optimization using arrow
                    pbp_data <- load_pbp(season)
                    cached_data[[cache_key]] <<- arrow_table(pbp_data)
                    # Force garbage collection after loading large datasets
                    gc()
                } else if (data_type == "rosters") {
                    cached_data[[cache_key]] <<- load_rosters(season)
                    gc()
                } else if (data_type == "player_stats") {
                    cached_data[[cache_key]] <<- load_player_stats(season)
                    gc()
                } else if (data_type == "schedules") {
                    cached_data[[cache_key]] <<- load_schedules(season)
                    gc()
                }
                cat("Successfully loaded", data_type, "for season", season, "\n")
            },
            error = function(e) {
                cat("Error loading", data_type, "for season", season, ":", e$message, "\n")
                stop(e)
            }
        )
    }

    return(cached_data[[cache_key]])
}

# Helper function to convert arrow table to data frame if needed
convert_arrow_to_df <- function(data) {
    if (inherits(data, "ArrowTable")) {
        return(as.data.frame(data))
    }
    return(data)
}

# Function to load multiple seasons efficiently with memory management
load_multiple_seasons <- function(data_type, seasons) {
    if (length(seasons) == 1) {
        return(load_data_with_cache(data_type, seasons))
    }

    # For multiple seasons, load each and combine with memory management
    all_data <- list()
    for (season in seasons) {
        cat("Loading season", season, "for", data_type, "...\n")
        all_data[[as.character(season)]] <- load_data_with_cache(data_type, season)
        # Force garbage collection between seasons
        gc()
    }

    # Combine all data frames
    if (data_type %in% c("pbp", "player_stats", "schedules")) {
        cat("Combining", length(seasons), "seasons of", data_type, "data...\n")
        # Convert arrow tables to data frames for combining
        all_data_df <- lapply(all_data, convert_arrow_to_df)
        combined_data <- do.call(rbind, all_data_df)
        # Clear individual season data to free memory
        rm(all_data, all_data_df)
        gc()
        return(combined_data)
    } else {
        # For rosters, just return the list
        return(all_data)
    }
}

#* Execute custom R code
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
            library(arrow)

            # Suppress nflreadr warnings
            options(nflreadr.verbose = FALSE)

            # Replace load_pbp, load_rosters, etc. with cached versions
            # This is a simple approach - in production you'd want more sophisticated code parsing
            code_modified <- code

            # Execute the code and capture the result
            result <- eval(parse(text = code_modified))

            # Convert arrow table back to regular data frame for JSON
            if (inherits(result, "ArrowTable")) {
                result <- as.data.frame(result)
            }

            # Force garbage collection after execution
            gc()

            # Convert to list for JSON serialization
            if (is.data.frame(result)) {
                # Convert data frame to list of lists
                result_list <- as.list(result)
                # Add column names as attributes
                attr(result_list, "column_names") <- names(result)
                attr(result_list, "row_count") <- nrow(result)
            } else {
                result_list <- result
            }

            # Clear any intermediate variables and force GC again
            rm(code_modified)
            gc()

            list(
                success = TRUE,
                result = result_list,
                code_executed = code
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
        cached_data_keys = names(cached_data),
        memory_usage = paste(round(memory.size() / 1024^2, 2), "MB"),
        arrow_available = requireNamespace("arrow", quietly = TRUE)
    )
}

#* Cache info
#* @get /cache-info
function() {
    cache_files <- list.files(cache_dir, full.names = TRUE)
    cache_size <- sum(file.size(cache_files))

    list(
        cache_dir = cache_dir,
        cache_files = length(cache_files),
        cache_size_mb = round(cache_size / 1024^2, 2),
        cached_data_keys = names(cached_data),
        memory_usage_mb = round(memory.size() / 1024^2, 2)
    )
}
