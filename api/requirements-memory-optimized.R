# Memory-optimized requirements for 2GB VPS
# Install packages one by one with error handling

cat("Installing memory-optimized requirements...\n")

# Function to install package with retry
install_package <- function(pkg, retries = 3) {
    for (i in 1:retries) {
        tryCatch(
            {
                cat("Installing", pkg, "(attempt", i, "of", retries, ")\n")

                # Set memory limit for this installation
                options(timeout = 300) # 5 minute timeout

                if (!require(pkg, character.only = TRUE, quietly = TRUE)) {
                    install.packages(pkg, dependencies = TRUE, quiet = TRUE)
                    library(pkg, character.only = TRUE)
                }

                cat("✓ Successfully installed", pkg, "\n")
                return(TRUE)
            },
            error = function(e) {
                cat("✗ Failed to install", pkg, "on attempt", i, ":", e$message, "\n")

                # Clear memory
                gc()
                Sys.sleep(2)

                if (i == retries) {
                    cat("✗ Failed to install", pkg, "after", retries, "attempts\n")
                    return(FALSE)
                }
            }
        )
    }
}

# Core packages (install these first)
core_packages <- c(
    "plumber",
    "dplyr",
    "data.table",
    "jsonlite"
)

cat("Installing core packages...\n")
for (pkg in core_packages) {
    if (!install_package(pkg)) {
        stop("Failed to install core package: ", pkg)
    }
}

# Install nflreadr (this is the heavy one)
cat("Installing nflreadr...\n")
if (!install_package("nflreadr")) {
    cat("Warning: nflreadr installation failed. API will have limited functionality.\n")
}

# Install DuckDB and DBI for database operations
cat("Installing DuckDB and DBI...\n")
if (!install_package("DBI")) {
    cat("Warning: DBI installation failed.\n")
}

if (!install_package("duckdb")) {
    cat("Warning: DuckDB installation failed.\n")
}

# Optional packages (install if possible)
optional_packages <- c(
    "ggplot2",
    "tidyr"
)

cat("Installing optional packages...\n")
for (pkg in optional_packages) {
    install_package(pkg)
}

cat("Installation complete!\n")
cat("Memory usage:", round(memory.size() / 1024, 2), "MB\n")
