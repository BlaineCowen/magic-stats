#* @apiTitle NFL Stats API (Simple Version)
#* @apiDescription API for NFL statistics using nflreadr data - optimized for low memory

# Cache directory
cache_dir <- "/app/cache"
dir.create(cache_dir, showWarnings = FALSE, recursive = TRUE)

# Set cache directory for nflreadr
options(nflreadr.cache = "filesystem")

# Helper function to get current season
get_current_season <- function() {
    as.numeric(format(Sys.Date(), "%Y")) - 1 # Use previous year since 2024 data isn't available yet
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

            # Execute the code and capture the result
            result <- eval(parse(text = code))

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

            # Force garbage collection after each request
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
        memory_usage = paste(round(memory.size() / 1024^2, 2), "MB")
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
        memory_usage_mb = round(memory.size() / 1024^2, 2)
    )
}
