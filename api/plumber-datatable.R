#* @apiTitle NFL Stats API (data.table Version)
#* @apiDescription API for NFL statistics using nflreadr + data.table for efficient memory usage

# Cache directory
cache_dir <- "/app/cache"
dir.create(cache_dir, showWarnings = FALSE, recursive = TRUE)

# Set cache directory for nflreadr
options(nflreadr.cache = "filesystem")

# Helper function to get current season
get_current_season <- function() {
    as.numeric(format(Sys.Date(), "%Y")) - 1
}

#* Execute custom R code with data.table optimization
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
            library(data.table)

            # Replace load_pbp with data.table version for better memory usage
            code_modified <- gsub(
                "load_pbp\\(([^)]+)\\)",
                "as.data.table(load_pbp(\\1))",
                code
            )

            # Execute the code and capture the result
            result <- eval(parse(text = code_modified))

            # Convert data.table back to regular data frame for JSON
            if (inherits(result, "data.table")) {
                result <- as.data.frame(result)
            }

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
