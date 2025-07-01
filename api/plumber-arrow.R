#* @apiTitle NFL Stats API (Arrow Version)
#* @apiDescription API for NFL statistics using nflreadr + arrow for large datasets

# Cache directory
cache_dir <- "/app/cache"
dir.create(cache_dir, showWarnings = FALSE, recursive = TRUE)

# Set cache directory for nflreadr
options(nflreadr.cache = "filesystem")

# Helper function to get current season
get_current_season <- function() {
    as.numeric(format(Sys.Date(), "%Y")) - 1
}

#* Execute custom R code with arrow optimization
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

            # Replace load_pbp with arrow-optimized version for large datasets
            code_modified <- gsub(
                "load_pbp\\(([^)]+)\\)",
                "load_pbp(\\1) %>% arrow_table()",
                code
            )

            # Execute the code and capture the result
            result <- eval(parse(text = code_modified))

            # Convert arrow table back to regular data frame for JSON
            if (inherits(result, "ArrowTable")) {
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
        memory_usage = paste(round(memory.size() / 1024^2, 2), "MB"),
        arrow_available = requireNamespace("arrow", quietly = TRUE)
    )
}
