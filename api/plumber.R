#* @apiTitle NFL Stats API
#* @apiDescription API for NFL statistics using nflreadr data

# Cache directory
cache_dir <- "/app/cache"
dir.create(cache_dir, showWarnings = FALSE, recursive = TRUE)

# Set cache directory for nflreadr
options(nflreadr.cache = cache_dir)

# Helper function to get current season
get_current_season <- function() {
    as.numeric(format(Sys.Date(), "%Y"))
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
        current_season = get_current_season()
    )
}
