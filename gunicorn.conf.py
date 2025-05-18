import multiprocessing

# Number of worker processes
workers = 1  # Reduce to 1 worker to manage memory better

# Maximum number of requests a worker will process before restarting
max_requests = 1000
max_requests_jitter = 50

# Timeout for worker processes
timeout = 120

# Maximum memory usage per worker (in bytes)
worker_memory_limit = 400 * 1024 * 1024  # 400MB

# Worker class
worker_class = 'sync'

# Logging
accesslog = '-'
errorlog = '-'
loglevel = 'info'

# Process naming
proc_name = 'social_media_analyzer'

# Server mechanics
daemon = False
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None 