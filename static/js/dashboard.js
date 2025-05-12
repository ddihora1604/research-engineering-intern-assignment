// Global state
let activeQuery = '';
let startDate = '';
let endDate = '';
let uploadedData = true;  // Always treat data as preloaded
let analysisPerformed = false; // Track if analysis has been performed

// Helper to show/hide main loading spinner
function showLoading(show) {
    const loadingElement = document.getElementById('loading');
    if (show) {
        loadingElement.style.display = 'block';
    } else {
        loadingElement.style.display = 'none';
    }
}

// Analysis button click handler
document.getElementById('analyze-btn').addEventListener('click', async () => {
    const query = document.getElementById('query-input').value;
    if (!query) {
        alert('Please enter a search query');
        return;
    }

    activeQuery = query;
    startDate = document.getElementById('start-date').value;
    endDate = document.getElementById('end-date').value;
    
    showLoading(true);
    
    try {
        // Clear all previous visualizations first
        document.getElementById('network-graph').innerHTML = '';
        document.getElementById('topics-container').innerHTML = '';
        document.getElementById('contributors-overview').innerHTML = '';
        document.getElementById('coordinated-graph').innerHTML = '';
        document.getElementById('coordinated-groups').innerHTML = '';
        document.getElementById('word-cloud').innerHTML = '';
        document.getElementById('timeseries-chart').innerHTML = '';
        document.getElementById('ai-summary').innerHTML = '';
        
        // Reset data story with placeholder
        document.getElementById('data-story').innerHTML = `
            <div class="card-body">
                <p class="text-muted">Generating comprehensive data story for "${query}"...</p>
            </div>
        `;
        
        // PERFORMANCE OPTIMIZATION: Load data progressively in phases
        // Phase 1: First load critical data for the overview tab
        const criticalPromises = [
            // Update AI summary - essential for overview
            updateOverview(query).catch(error => {
                console.error('Error updating overview:', error);
                document.getElementById('ai-summary').innerHTML = '<p class="text-danger">Error loading overview data</p>';
            }),
            // Update top contributors (small visualization) - essential for overview
            updateContributorsOverview(query).catch(error => {
                console.error('Error updating contributors overview:', error);
                document.getElementById('contributors-overview').innerHTML = '<p class="text-danger">Error loading contributors data</p>';
            }),
            // Update word cloud - lightweight visualization for overview
            updateWordCloud(query).catch(error => {
                console.error('Error updating word cloud:', error);
                document.getElementById('word-cloud').innerHTML = '<p class="text-danger">Error loading word cloud data</p>';
            })
        ];

        // Wait for critical components first
        await Promise.allSettled(criticalPromises);
        
        // Hide the main loading spinner as critical content is loaded
        showLoading(false);
        
        // Mark that analysis has been performed
        analysisPerformed = true;
        
        // PERFORMANCE OPTIMIZATION: Create placeholder loading indicators for remaining components
        document.getElementById('timeseries-chart').innerHTML = '<div class="section-loading"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading time series analysis...</div>';
        document.getElementById('network-graph').innerHTML = '<div class="section-loading"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading network analysis...</div>';
        document.getElementById('topics-container').innerHTML = '<div class="section-loading"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading topic analysis...</div>';
        document.getElementById('coordinated-graph').innerHTML = '<div class="section-loading"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading coordinated behavior analysis...</div>';
        document.getElementById('coordinated-groups').innerHTML = '';
        
        // Phase 2: Load the data story and time series (medium weight)
        // Generate a data story based on the analyzed results
        setTimeout(async () => {
            try {
                await generateDataStory(query);
                
                // Update time series (important for overview)
                await updateTimeSeries(query).catch(error => {
                    console.error('Error updating time series:', error);
                    document.getElementById('timeseries-chart').innerHTML = '<p class="text-danger">Error loading time series data</p>';
                });
                
                // Phase 3: Now load the remaining heavier visualizations in the background
                // This allows the user to start interacting with the dashboard while heavy visualizations load
                setTimeout(async () => {
                    // Process remaining heavy visualizations in sequence to reduce load
                    try {
                        await updateTopics(query);
                    } catch (error) {
                        console.error('Error updating topics:', error);
                        document.getElementById('topics-container').innerHTML = '<p class="text-danger">Error loading topics data</p>';
                    }
                    
                    try {
                        await updateNetwork(query);
                    } catch (error) {
                        console.error('Error updating network:', error);
                        document.getElementById('network-graph').innerHTML = '<p class="text-danger">Error loading network data</p>';
                    }
                    
                    try {
                        await updateCoordinatedBehavior();
                    } catch (error) {
                        console.error('Error updating coordinated behavior:', error);
                        document.getElementById('coordinated-graph').innerHTML = '<p class="text-danger">Error loading coordinated behavior data</p>';
                        document.getElementById('coordinated-groups').innerHTML = '<p class="text-danger">Error loading coordinated groups data</p>';
                    }
                    
                    console.log('All visualizations loaded');
                }, 100);
                
            } catch (error) {
                console.error('Error in phase 2 loading:', error);
            }
        }, 10);
        
    } catch (error) {
        console.error('Error during analysis:', error);
        alert('Error performing analysis. Please check the console for details.');
        showLoading(false);
    }
});

// Initialize sliders and their value displays
document.getElementById('topics-count').addEventListener('input', (e) => {
    document.getElementById('topics-count-value').textContent = e.target.value;
});

document.getElementById('time-window').addEventListener('input', (e) => {
    document.getElementById('time-window-value').textContent = e.target.value;
});

document.getElementById('similarity-threshold').addEventListener('input', (e) => {
    document.getElementById('similarity-threshold-value').textContent = e.target.value;
});

// Button handlers for updating specific visualizations - only perform updates if sliders change
document.getElementById('update-topics-btn').addEventListener('click', async () => {
    showLoading(true);
    await updateTopics(activeQuery);
    showLoading(false);
});

document.getElementById('update-coordinated-btn').addEventListener('click', async () => {
    showLoading(true);
    await updateCoordinatedBehavior();
    showLoading(false);
});

// Initialize tab change listeners to ensure visualizations render properly on tab change
document.addEventListener('DOMContentLoaded', function() {
    const tabLinks = document.querySelectorAll('.nav-link');
    
    // When the page loads, make sure the active tab is properly set up
    const activeTab = document.querySelector('.nav-link.active');
    if (activeTab) {
        // Manually trigger the resize event to ensure proper initial rendering
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 100);
    }
    
    tabLinks.forEach(tab => {
        tab.addEventListener('shown.bs.tab', function(event) {
            // Trigger resize event to ensure visualizations are properly sized
            window.dispatchEvent(new Event('resize'));
            
            // If no analysis has been performed yet, no need to do anything else
            if (!analysisPerformed || !activeQuery) {
                return;
            }
            
            // Get the newly activated tab target
            const targetTab = event.target.getAttribute('data-bs-target');
            
            // Based on which tab is now active, ensure visualizations are properly rendered
            switch (targetTab) {
                case '#network-panel':
                    // If network graph is empty, re-render it
                    if (document.getElementById('network-graph').innerHTML === '' || 
                       document.getElementById('network-graph').getBoundingClientRect().height < 10) {
                        console.log('Re-rendering network graph on tab change');
                        showLoading(true);
                        updateNetwork(activeQuery)
                            .catch(error => {
                                console.error('Error updating network:', error);
                                document.getElementById('network-graph').innerHTML = '<p class="text-danger">Error loading network data</p>';
                            })
                            .finally(() => {
                                showLoading(false);
                            });
                    }
                    break;
                case '#timeseries-panel':
                    // If timeseries chart is empty, re-render it
                    if (document.getElementById('timeseries-chart').innerHTML === '' ||
                       document.getElementById('timeseries-chart').getBoundingClientRect().height < 10) {
                        console.log('Re-rendering time series on tab change');
                        showLoading(true);
                        updateTimeSeries(activeQuery)
                            .catch(error => {
                                console.error('Error updating time series:', error);
                                document.getElementById('timeseries-chart').innerHTML = '<p class="text-danger">Error loading time series data</p>';
                            })
                            .finally(() => {
                                showLoading(false);
                            });
                    }
                    break;
                case '#topics-panel':
                    // If topics container is empty, re-render it
                    if (document.getElementById('topics-container').innerHTML === '') {
                        console.log('Re-rendering topics on tab change');
                        showLoading(true);
                        updateTopics(activeQuery)
                            .catch(error => {
                                console.error('Error updating topics:', error);
                                document.getElementById('topics-container').innerHTML = '<p class="text-danger">Error loading topics data</p>';
                            })
                            .finally(() => {
                                showLoading(false);
                            });
                    }
                    break;
                case '#coordinated-panel':
                    // If coordinated graph is empty, re-render it
                    if (document.getElementById('coordinated-graph').innerHTML === '' || 
                        document.getElementById('coordinated-groups').innerHTML === '') {
                        console.log('Re-rendering coordinated behavior on tab change');
                        showLoading(true);
                        updateCoordinatedBehavior()
                            .catch(error => {
                                console.error('Error updating coordinated behavior:', error);
                                document.getElementById('coordinated-graph').innerHTML = '<p class="text-danger">Error loading coordinated behavior data</p>';
                                document.getElementById('coordinated-groups').innerHTML = '<p class="text-danger">Error loading coordinated groups data</p>';
                            })
                            .finally(() => {
                                showLoading(false);
                            });
                    }
                    break;
                // Overview tab doesn't need special handling as it's loaded by default
            }
        });
    });
});

// Overview Section - AI Summary and Metrics
async function updateOverview(query) {
    try {
        // Update AI summary with enhanced insights
        const summaryResponse = await fetch(`/api/ai_summary?query=${encodeURIComponent(query)}`);
        if (summaryResponse.ok) {
            const summaryData = await summaryResponse.json();
            
            // Display model used and enhanced summary
            document.getElementById('ai-summary').innerHTML = `
                <h4>Analysis of "${query}"</h4>
                <div class="alert alert-info small mb-2">Analysis powered by ${summaryData.model_used}</div>
                <p>${summaryData.summary}</p>
            `;
            
            // Update metrics with enhanced data
            const metrics = summaryData.metrics;
            
            // Basic metrics
            document.getElementById('total-posts').textContent = metrics.total_posts || '-';
            document.getElementById('unique-authors').textContent = metrics.unique_authors || '-';
            document.getElementById('avg-comments').textContent = typeof metrics.avg_comments === 'number' ? 
                metrics.avg_comments.toFixed(1) : metrics.avg_comments;
            document.getElementById('time-span').textContent = metrics.days_span || '-';
            
            // Create extended metrics display
            let metricsContainer = document.getElementById('metrics-container');
            
            // Add additional metrics rows if needed
            if (metrics.top_keywords && metrics.top_keywords.length > 0) {
                const keywordsRow = document.createElement('div');
                keywordsRow.className = 'row mt-3';
                keywordsRow.innerHTML = `
                    <div class="col-12">
                        <div class="stat-card">
                            <div class="stat-label">Top Keywords</div>
                            <div class="keyword-container">
                                ${metrics.top_keywords.map(kw => 
                                    `<span class="badge bg-primary me-1">${kw}</span>`
                                ).join('')}
                            </div>
                        </div>
                    </div>
                `;
                metricsContainer.appendChild(keywordsRow);
            }
            
            // Add top authors
            if (metrics.top_authors) {
                const authorsRow = document.createElement('div');
                authorsRow.className = 'row mt-3';
                authorsRow.innerHTML = `
                    <div class="col-12">
                        <div class="stat-card">
                            <div class="stat-label">Top Authors</div>
                            <div class="author-container">
                                <ul class="list-group list-group-flush small">
                                    ${Object.entries(metrics.top_authors).slice(0, 3).map(([author, count]) => 
                                        `<li class="list-group-item d-flex justify-content-between align-items-center">
                                            ${author}
                                            <span class="badge bg-primary rounded-pill">${count} posts</span>
                                        </li>`
                                    ).join('')}
                                </ul>
                            </div>
                        </div>
                    </div>
                `;
                metricsContainer.appendChild(authorsRow);
            }
            
            // Add engagement trend if available
            if (metrics.engagement_trend && Object.keys(metrics.engagement_trend).length > 0) {
                const engagementRow = document.createElement('div');
                engagementRow.className = 'row mt-3';
                engagementRow.innerHTML = `
                    <div class="col-12">
                        <div class="stat-card">
                            <div class="stat-label">Engagement Trend</div>
                            <div id="engagement-trend-chart" style="height: 100px;"></div>
                        </div>
                    </div>
                `;
                metricsContainer.appendChild(engagementRow);
                
                // Create mini chart for engagement trend
                setTimeout(() => {
                    const trendData = Object.entries(metrics.engagement_trend).map(([date, value]) => ({
                        date: new Date(date),
                        value: value
                    })).sort((a, b) => a.date - b.date);
                    
                    if (trendData.length > 1) {
                        const trendWidth = document.getElementById('engagement-trend-chart').clientWidth;
                        const trendHeight = 100;
                        
                        const svg = d3.select('#engagement-trend-chart')
                            .append('svg')
                            .attr('width', trendWidth)
                            .attr('height', trendHeight);
                        
                        const x = d3.scaleTime()
                            .domain(d3.extent(trendData, d => d.date))
                            .range([0, trendWidth]);
                        
                        const y = d3.scaleLinear()
                            .domain([0, d3.max(trendData, d => d.value)])
                            .range([trendHeight, 0]);
                        
                        // Add the line
                        svg.append('path')
                            .datum(trendData)
                            .attr('fill', 'none')
                            .attr('stroke', '#0d6efd')
                            .attr('stroke-width', 2)
                            .attr('d', d3.line()
                                .x(d => x(d.date))
                                .y(d => y(d.value))
                            );
                    }
                }, 100);
            }
        }
        
        // Update top contributors (simplified version for overview)
        await updateContributorsOverview(query);
        
    } catch (error) {
        console.error('Error updating overview:', error);
    }
}

// Top Contributors - Overview Section
async function updateContributorsOverview(query) {
    const response = await fetch(`/api/top_contributors?query=${encodeURIComponent(query)}&limit=10`);
    const data = await response.json();
    
    const containerWidth = document.getElementById('contributors-overview').clientWidth;
    const margin = {top: 20, right: 20, bottom: 40, left: 60};
    const width = containerWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;
    
    // Clear previous chart
    d3.select('#contributors-overview').html('');
    
    const svg = d3.select('#contributors-overview')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Sort data by count in descending order
    data.sort((a, b) => b.count - a.count);
    
    const x = d3.scaleBand()
        .range([0, width])
        .domain(data.map(d => d.author))
        .padding(0.2);
    
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count)])
        .range([height, 0]);
    
    // Add X axis
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .attr('transform', 'translate(-10,0)rotate(-45)')
        .style('text-anchor', 'end');
    
    // Add Y axis
    svg.append('g')
        .call(d3.axisLeft(y));
    
    // Add bars
    svg.selectAll('rect')
        .data(data)
        .enter()
        .append('rect')
        .attr('x', d => x(d.author))
        .attr('y', d => y(d.count))
        .attr('width', x.bandwidth())
        .attr('height', d => height - y(d.count))
        .attr('fill', '#0d6efd');
    
    // Add title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', -margin.top / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .text(`Top 10 Contributors for "${query}"`);
}

// Word Cloud Visualization
async function updateWordCloud(query) {
    try {
        const response = await fetch(`/api/common_words?query=${encodeURIComponent(query)}&limit=100`);
        const words = await response.json();
        
        // Get the word cloud container and check if it exists
        const wordCloudContainer = document.getElementById('word-cloud');
        if (!wordCloudContainer) {
            console.warn('Word cloud container not found');
            return;
        }
        
        // Clear previous word cloud
        d3.select('#word-cloud').html('');
        
        const width = wordCloudContainer.clientWidth;
        const height = 300;
        
        // Scale for word size
        const fontSize = d3.scaleLinear()
            .domain([0, d3.max(words, d => d.count)])
            .range([12, 60]);
        
        // Create layout
        const layout = d3.layout.cloud()
            .size([width, height])
            .words(words.map(d => ({
                text: d.word, 
                size: fontSize(d.count),
                value: d.count
            })))
            .padding(5)
            .rotate(() => 0)
            .font('Arial')
            .fontSize(d => d.size)
            .on('end', draw);
        
        layout.start();
        
        function draw(words) {
            // Color scale
            const color = d3.scaleOrdinal(d3.schemeCategory10);
            
            d3.select('#word-cloud')
                .append('svg')
                .attr('width', width)
                .attr('height', height)
                .append('g')
                .attr('transform', `translate(${width/2},${height/2})`)
                .selectAll('text')
                .data(words)
                .enter()
                .append('text')
                .style('font-size', d => `${d.size}px`)
                .style('font-family', 'Arial')
                .style('fill', (d, i) => color(i % 10))
                .attr('text-anchor', 'middle')
                .attr('transform', d => `translate(${d.x},${d.y}) rotate(${d.rotate})`)
                .text(d => d.text)
                .append('title')
                .text(d => {
                    // Safe handling of value property to avoid the toFixed error
                    const value = typeof d.value === 'number' ? d.value : (d.value || 0);
                    return `${d.text}: ${value}`;
                });
        }
    } catch (error) {
        console.error('Error updating word cloud:', error);
        const wordCloudContainer = document.getElementById('word-cloud');
        if (wordCloudContainer) {
            wordCloudContainer.innerHTML = '<div class="alert alert-danger">Error loading word cloud data</div>';
        }
    }
}

// Time Series Visualization
async function updateTimeSeries(query) {
    const params = new URLSearchParams({
        query: query
    });
    
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    const response = await fetch(`/api/timeseries?${params.toString()}`);
    const data = await response.json();
    
    // If there's no data, show a message
    if (!data || data.length === 0) {
        document.getElementById('timeseries-chart').innerHTML = '<div class="alert alert-info">No time series data available for this query.</div>';
        return;
    }
    
    const timeseriesElement = document.getElementById('timeseries-chart');
    const containerWidth = timeseriesElement.clientWidth || timeseriesElement.offsetWidth || 800; // Fallback width
    const margin = {top: 20, right: 20, bottom: 30, left: 50};
    const width = containerWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;
    
    // Clear previous chart
    d3.select('#timeseries-chart').html('');
    
    // Create SVG
    const svg = d3.select('#timeseries-chart')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Parse dates
    data.forEach(d => {
        d.date = new Date(d.date);
    });
    
    // Sort data by date
    data.sort((a, b) => a.date - b.date);
    
    // Create scales
    const x = d3.scaleTime()
        .domain(d3.extent(data, d => d.date))
        .range([0, width]);
    
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count)])
        .range([height, 0]);
    
    // Create area gradient
    svg.append('linearGradient')
        .attr('id', 'area-gradient')
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', 0).attr('y1', y(0))
        .attr('x2', 0).attr('y2', y(d3.max(data, d => d.count)))
        .selectAll('stop')
        .data([
            {offset: '0%', color: 'rgba(13, 110, 253, 0.1)'},
            {offset: '100%', color: 'rgba(13, 110, 253, 0.6)'}
        ])
        .enter().append('stop')
        .attr('offset', d => d.offset)
        .attr('stop-color', d => d.color);
    
    // Add the area
    svg.append('path')
        .datum(data)
        .attr('fill', 'url(#area-gradient)')
        .attr('stroke', 'none')
        .attr('d', d3.area()
            .x(d => x(d.date))
            .y0(height)
            .y1(d => y(d.count))
        );
    
    // Add the line
    svg.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#0d6efd')
        .attr('stroke-width', 2)
        .attr('d', d3.line()
            .x(d => x(d.date))
            .y(d => y(d.count))
        );
    
    // Add data points
    svg.selectAll('.dot')
        .data(data)
        .enter().append('circle')
        .attr('class', 'dot')
        .attr('cx', d => x(d.date))
        .attr('cy', d => y(d.count))
        .attr('r', 4)
        .attr('fill', '#0d6efd')
        .append('title')
        .text(d => `Date: ${d.date.toLocaleDateString()}\nPosts: ${d.count}`);
    
    // Add X axis
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x));
    
    // Add Y axis
    svg.append('g')
        .call(d3.axisLeft(y));
    
    // Add title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', -margin.top / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .text(`Post Frequency for "${query}"`);
    
    // Add Y axis label
    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left)
        .attr('x', 0 - (height / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .text('Number of Posts');
    
    // Force a redraw if needed (helps with rendering issues)
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
}

// Top Contributors Visualization - Full Page
async function updateContributors(query) {
    const response = await fetch(`/api/top_contributors?query=${encodeURIComponent(query)}&limit=20`);
    const data = await response.json();
    
    // Create a pie chart based on the top contributors
    const width = 600;
    const height = 400;
    const radius = Math.min(width, height) / 2;
    
    // Clear previous chart
    d3.select('#contributors').html('');
    
    const svg = d3.select('#contributors')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);
    
    // Color scale
    const color = d3.scaleOrdinal(d3.schemeCategory10);
    
    // Compute the position of each group on the pie:
    const pie = d3.pie()
        .value(d => d.count)
        .sort(null);
    
    const data_ready = pie(data);
    
    // Shape helper to build arcs:
    const arcGenerator = d3.arc()
        .innerRadius(0)
        .outerRadius(radius);
    
    // Build the pie chart
    svg.selectAll('slices')
        .data(data_ready)
        .enter()
        .append('path')
        .attr('d', arcGenerator)
        .attr('fill', (d, i) => color(i))
        .attr('stroke', 'white')
        .style('stroke-width', '2px')
        .style('opacity', 0.7);
    
    // Add labels
    svg.selectAll('slices')
        .data(data_ready)
        .enter()
        .append('text')
        .text(d => d.data.author)
        .attr('transform', d => {
            const pos = arcGenerator.centroid(d);
            const midAngle = Math.atan2(pos[1], pos[0]);
            const x = Math.cos(midAngle) * (radius + 20);
            const y = Math.sin(midAngle) * (radius + 20);
            return `translate(${x},${y})`;
        })
        .style('text-anchor', d => {
            const pos = arcGenerator.centroid(d);
            return (pos[0] > 0) ? 'start' : 'end';
        })
        .style('font-size', '12px')
        .style('font-weight', 'bold');
    
    // Add polylines between pie and labels
    svg.selectAll('allPolylines')
        .data(data_ready)
        .enter()
        .append('polyline')
        .attr('stroke', 'black')
        .style('fill', 'none')
        .attr('stroke-width', 1)
        .attr('points', d => {
            const posA = arcGenerator.centroid(d);  // line insertion in the slice
            const posB = arcGenerator.centroid(d);  // line break: we use the same y as posA
            const posC = arcGenerator.centroid(d);  // Label position = almost the same as posB
            const midAngle = Math.atan2(posA[1], posA[0]);
            const posB_x = Math.cos(midAngle) * (radius + 10);
            const posB_y = Math.sin(midAngle) * (radius + 10);
            const posC_x = Math.cos(midAngle) * (radius + 20);
            const posC_y = Math.sin(midAngle) * (radius + 20);
            return [posA, [posB_x, posB_y], [posC_x, posC_y]];
        });
    
    // Add title
    svg.append('text')
        .attr('x', 0)
        .attr('y', -height/2 + 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .text(`Top Contributors for "${query}"`);
}

// Network Visualization - Optimized version
async function updateNetwork(query) {
    const response = await fetch(`/api/network?query=${encodeURIComponent(query)}`);
    if (!response.ok) {
        throw new Error(`Network request failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check if we have valid data
    if (!data.nodes || data.nodes.length === 0) {
        document.getElementById('network-graph').innerHTML = '<div class="alert alert-info">No network data available for this query.</div>';
        return;
    }
    
    // Clear previous chart
    d3.select('#network-graph').html('');
    
    const networkElement = document.getElementById('network-graph');
    const width = networkElement.clientWidth || networkElement.offsetWidth || 800; // Fallback width
    const height = 500; // Reduced height to improve performance
    
    // PERFORMANCE OPTIMIZATION: Simplify data for better performance
    // Limit the number of nodes - significantly reduced from 100 to 50 for better performance
    const maxNodes = 50;
    let nodes = data.nodes;
    let links = data.links;
    
    // PERFORMANCE OPTIMIZATION: More aggressive filtering for large networks
    if (nodes.length > maxNodes) {
        // Sort nodes by size/posts and take only the top ones
        nodes = nodes.sort((a, b) => (b.posts || 0) - (a.posts || 0)).slice(0, maxNodes);
        // Filter links to only include the nodes we kept
        const nodeIds = new Set(nodes.map(n => n.id));
        links = links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));
    }
    
    // PERFORMANCE OPTIMIZATION: Further reduce complexity for very large networks
    if (nodes.length > 30) {
        // For larger networks, reduce link complexity 
        links = links.filter((_, index) => index % 2 === 0); // Take every other link
    }
    
    // Define a color scale for node groups (communities)
    const color = d3.scaleOrdinal(d3.schemeCategory10);
    
    // Create SVG container
    const svg = d3.select('#network-graph')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(0,0)`);
    
    // Add a title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .text(`User Interaction Network for "${query}"`);
    
    // PERFORMANCE OPTIMIZATION: Simplified forces and reduced iterations
    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links)
            .id(d => d.id)
            .distance(75)) // Increased distance for less crowding
        .force('charge', d3.forceManyBody().strength(-80)) // Reduced strength
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(d => Math.min((d.size || 5) + 2, 15))) // Cap the radius
        .alphaDecay(0.05) // Faster cooling - reduces number of simulation iterations
        .velocityDecay(0.4); // Higher friction - stabilizes faster
    
    // PERFORMANCE OPTIMIZATION: Use canvas for larger networks for better performance
    if (nodes.length > 30) {
        // For large networks, use canvas instead of SVG elements
        d3.select('#network-graph svg').remove();
        
        const canvas = d3.select('#network-graph')
            .append('canvas')
            .attr('width', width)
            .attr('height', height)
            .node();
        
        const context = canvas.getContext('2d');
        
        // Function to draw network on canvas
        function drawNetwork() {
            context.clearRect(0, 0, width, height);
            
            // Draw title
            context.font = '16px sans-serif';
            context.textAlign = 'center';
            context.fillText(`User Interaction Network for "${query}"`, width/2, 20);
            
            // Draw links
            context.strokeStyle = '#999';
            context.lineWidth = 1;
            context.globalAlpha = 0.6;
            links.forEach(link => {
                context.beginPath();
                context.moveTo(link.source.x, link.source.y);
                context.lineTo(link.target.x, link.target.y);
                context.stroke();
            });
            
            // Draw nodes
            context.globalAlpha = 1.0;
            nodes.forEach(node => {
                context.beginPath();
                context.arc(
                    Math.max(10, Math.min(width - 10, node.x || width/2)),
                    Math.max(10, Math.min(height - 10, node.y || height/2)),
                    Math.min((node.size || 5), 12),
                    0, 
                    2 * Math.PI
                );
                context.fillStyle = color(node.group || 0);
                context.fill();
                context.strokeStyle = '#fff';
                context.stroke();
            });
            
            // Draw top node labels
            context.font = '8px sans-serif';
            context.fillStyle = '#000';
            nodes.slice(0, 10).forEach(node => {
                context.fillText(
                    node.id,
                    Math.max(10, Math.min(width - 10, (node.x || width/2) + 10)),
                    Math.max(10, Math.min(height - 10, (node.y || height/2) + 3))
                );
            });
            
            // Draw info text
            context.font = '10px sans-serif';
            context.fillStyle = '#666';
            context.textAlign = 'left';
            context.fillText(`Showing ${nodes.length} of ${data.nodes.length} nodes for better performance`, 10, height - 10);
        }
        
        // Update simulation to use canvas renderer
        simulation.on('tick', () => {
            // Constrain nodes to view
            nodes.forEach(node => {
                node.x = Math.max(10, Math.min(width - 10, node.x));
                node.y = Math.max(10, Math.min(height - 10, node.y));
            });
            drawNetwork();
        });
        
        // Add canvas interaction for node dragging
        d3.select(canvas).call(d3.drag()
            .container(canvas)
            .subject(() => {
                const x = d3.event.x;
                const y = d3.event.y;
                let closest = null;
                let closestDistance = Infinity;
                
                // Find the closest node to the mouse
                nodes.forEach(node => {
                    const dx = node.x - x;
                    const dy = node.y - y;
                    const distance = dx * dx + dy * dy;
                    if (distance < closestDistance) {
                        closest = node;
                        closestDistance = distance;
                    }
                });
                
                // Only select a node if it's close enough to the mouse
                if (closestDistance < 200) {
                    return closest;
                }
            })
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));
    } else {
        // For smaller networks, use SVG as before
        // Create links with simplified styling
        const link = svg.append('g')
            .selectAll('line')
            .data(links)
            .enter()
            .append('line')
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 1);
        
        // Create nodes with simplified styling
        const node = svg.append('g')
            .selectAll('circle')
            .data(nodes)
            .enter()
            .append('circle')
            .attr('r', d => Math.min((d.size || 5), 12)) // Cap the radius
            .attr('fill', d => color(d.group || 0))
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));
        
        // Add tooltips
        node.append('title')
            .text(d => `${d.id} (${d.posts || 0} posts)`);
        
        // PERFORMANCE OPTIMIZATION: Only label a few top nodes
        svg.append('g')
            .selectAll('text')
            .data(nodes.filter((d, i) => i < 10)) // Only label top 10 nodes
            .enter()
            .append('text')
            .attr('dx', 8)
            .attr('dy', '.35em')
            .text(d => d.id)
            .style('font-size', '8px') // Smaller font
            .style('pointer-events', 'none');
        
        // PERFORMANCE OPTIMIZATION: Optimize the tick function - render less frequently
        let ticks = 0;
        simulation.on('tick', () => {
            ticks++;
            // Only update every 3 ticks for better performance
            if (ticks % 3 !== 0) return;
            
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
            
            node
                .attr('cx', d => d.x = Math.max(10, Math.min(width - 10, d.x)))
                .attr('cy', d => d.y = Math.max(10, Math.min(height - 10, d.y)));
            
            // Update label positions
            svg.selectAll('text')
                .attr('x', d => d ? d.x : 0)
                .attr('y', d => d ? d.y : 0);
        });
        
        // Add a note about performance optimization
        svg.append('text')
            .attr('x', 10)
            .attr('y', height - 10)
            .style('font-size', '10px')
            .style('fill', '#666')
            .text(`Showing ${nodes.length} of ${data.nodes.length} nodes for better performance`);
    }
    
    // PERFORMANCE OPTIMIZATION: Stop the simulation after fewer iterations
    // Stop the simulation after a certain number of ticks for better performance
    setTimeout(() => simulation.stop(), 2000);
    
    // Drag functions
    function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }
    
    function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }
    
    function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
    }
}

// Topic Analysis Visualization - Enhanced version
async function updateTopics(query) {
    const topicsCount = document.getElementById('topics-count').value;
    const response = await fetch(`/api/topics?n_topics=${topicsCount}&query=${encodeURIComponent(query)}`);
    if (!response.ok) {
        throw new Error(`Topics request failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check if we have valid data
    if (!data || !data.topics || data.topics.length === 0) {
        document.getElementById('topics-container').innerHTML = '<div class="alert alert-info">No topic data available for this query.</div>';
        return;
    }
    
    // Clear previous visualization
    document.getElementById('topics-container').innerHTML = '';
    
    // Create the enhanced topic visualization
    const topicsContainer = document.getElementById('topics-container');
    
    // Add summary metrics
    const metricsHtml = `
        <div class="card mb-4">
            <div class="card-body">
                <div class="row">
                    <div class="col-md-4 text-center">
                        <div class="h2">${data.n_docs_analyzed}</div>
                        <div class="text-muted">Documents Analyzed</div>
                    </div>
                    <div class="col-md-4 text-center">
                        <div class="h2">${data.topics.length}</div>
                        <div class="text-muted">Topics Identified</div>
                    </div>
                    <div class="col-md-4 text-center">
                        <div class="h2">${data.coherence_score ? (data.coherence_score * 100).toFixed(1) : '0'}%</div>
                        <div class="text-muted">Coherence Score</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    topicsContainer.innerHTML = metricsHtml;
    
    // PERFORMANCE OPTIMIZATION: Simplified topic evolution chart
    // Create topic evolution chart only if there's a reasonable amount of data
    if (data.topic_evolution && Object.keys(data.topic_evolution).length > 0) {
        // Count total data points to decide on optimization level
        let totalDataPoints = 0;
        let maxTopics = 0;
        
        for (const [topicId, dateCounts] of Object.entries(data.topic_evolution)) {
            maxTopics++;
            totalDataPoints += Object.keys(dateCounts).length;
        }
        
        // Only show evolution chart if there's not too much data
        if (totalDataPoints < 200 && maxTopics <= 5) {
            const evolutionContainer = document.createElement('div');
            evolutionContainer.className = 'card mb-4';
            evolutionContainer.innerHTML = `
                <div class="card-header">
                    <h5 class="mb-0">Topic Evolution Over Time</h5>
                </div>
                <div class="card-body">
                    <div id="topic-evolution-chart" style="height: 300px;"></div>
                </div>
            `;
            topicsContainer.appendChild(evolutionContainer);
            
            // Process data for the chart
            setTimeout(() => {
                const evolutionChart = document.getElementById('topic-evolution-chart');
                const chartWidth = evolutionChart.clientWidth;
                const chartHeight = 300;
                
                // Process evolution data for visualization
                const timeData = {};
                const allDates = new Set();
                const topicIds = [];
                
                // Collect all dates and topic ids
                for (const [topicId, dateCounts] of Object.entries(data.topic_evolution)) {
                    topicIds.push(topicId);
                    for (const date of Object.keys(dateCounts)) {
                        allDates.add(date);
                    }
                }
                
                // Sort dates chronologically
                const sortedDates = Array.from(allDates).sort();
                
                // Create data points for each topic over time
                const chartData = [];
                topicIds.forEach((topicId, i) => {
                    const topicData = {
                        name: `Topic ${topicId.split('_')[1]}`,
                        values: []
                    };
                    
                    sortedDates.forEach(date => {
                        topicData.values.push({
                            date: new Date(date),
                            value: data.topic_evolution[topicId][date] || 0
                        });
                    });
                    
                    chartData.push(topicData);
                });
                
                // Create the chart
                const svg = d3.select('#topic-evolution-chart')
                    .append('svg')
                    .attr('width', chartWidth)
                    .attr('height', chartHeight);
                
                // Setup scales
                const x = d3.scaleTime()
                    .domain(d3.extent(sortedDates, d => new Date(d)))
                    .range([50, chartWidth - 20]);
                
                // Find max value across all topics and dates
                const maxValue = d3.max(chartData, d => d3.max(d.values, v => v.value));
                
                const y = d3.scaleLinear()
                    .domain([0, maxValue])
                    .range([chartHeight - 30, 20]);
                
                // Add axes
                svg.append('g')
                    .attr('transform', `translate(0,${chartHeight - 30})`)
                    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat('%b %d')));
                
                svg.append('g')
                    .attr('transform', 'translate(50,0)')
                    .call(d3.axisLeft(y));
                
                // Add lines for each topic
                const color = d3.scaleOrdinal(d3.schemeCategory10);
                const line = d3.line()
                    .x(d => x(d.date))
                    .y(d => y(d.value))
                    // PERFORMANCE OPTIMIZATION: Use linear curves instead of basis for better performance
                    .curve(d3.curveLinear);
                
                chartData.forEach((topic, i) => {
                    svg.append('path')
                        .datum(topic.values)
                        .attr('fill', 'none')
                        .attr('stroke', color(i))
                        .attr('stroke-width', 2)
                        .attr('d', line);
                    
                    // PERFORMANCE OPTIMIZATION: Only add text for significant values
                    // Add topic name at the end of the line
                    const lastDataPoint = topic.values[topic.values.length - 1];
                    if (lastDataPoint && lastDataPoint.value > maxValue * 0.1) {
                        svg.append('text')
                            .attr('x', x(lastDataPoint.date) + 5)
                            .attr('y', y(lastDataPoint.value))
                            .attr('fill', color(i))
                            .attr('font-size', '12px')
                            .text(topic.name);
                    }
                });
            }, 100);
        } else {
            // Display a simplified message for large datasets
            const evolutionContainer = document.createElement('div');
            evolutionContainer.className = 'card mb-4';
            evolutionContainer.innerHTML = `
                <div class="card-header">
                    <h5 class="mb-0">Topic Evolution</h5>
                </div>
                <div class="card-body">
                    <p class="text-muted">Topic evolution details are available but simplified for performance reasons.</p>
                    <p>Topics identified: ${maxTopics}, Total data points: ${totalDataPoints}</p>
                </div>
            `;
            topicsContainer.appendChild(evolutionContainer);
        }
    }
    
    // PERFORMANCE OPTIMIZATION: Create topic cards with lazy-loaded visualizations
    // Limit to 5 topic cards for performance
    const visibleTopics = Math.min(data.topics.length, 5);
    
    // Create cards for the first 5 topics
    for (let i = 0; i < visibleTopics; i++) {
        const topic = data.topics[i];
        const topicCard = document.createElement('div');
        topicCard.className = 'card mb-3';
        
        // Create simplified word cloud data for this topic
        const wordCloudData = topic.word_weight_pairs.slice(0, 20).map(pair => ({
            text: pair.word,
            size: 14 + (pair.weight * 1.5), // Scale weight to font size
            weight: pair.weight
        }));
        
        // Topic card with word cloud and representative docs
        topicCard.innerHTML = `
            <div class="card-header bg-light">
                <h5 class="mb-0">Topic ${topic.topic_id + 1}</h5>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-7">
                        <div id="topic-cloud-${topic.topic_id}" class="word-cloud" style="height: 200px;">
                            <div class="section-loading"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading word cloud...</div>
                        </div>
                    </div>
                    <div class="col-md-5">
                        <h6>Key Words</h6>
                        <div class="keyword-list">
                            ${topic.word_weight_pairs.slice(0, 8).map(pair => 
                                `<div class="d-flex justify-content-between mb-1">
                                    <span>${pair.word}</span>
                                    <div class="progress flex-grow-1 mx-2" style="height: 6px; margin-top: 8px;">
                                        <div class="progress-bar" style="width: ${pair.weight}%"></div>
                                    </div>
                                    <span class="badge bg-secondary">${pair.weight.toFixed(1)}%</span>
                                </div>`
                            ).join('')}
                        </div>
                    </div>
                </div>
                ${topic.representative_docs && topic.representative_docs.length > 0 ? `
                    <div class="mt-3">
                        <h6>Representative Posts</h6>
                        <ul class="list-group">
                            ${topic.representative_docs.slice(0, 2).map(doc => `
                                <li class="list-group-item">
                                    <div class="small text-muted">r/${doc.subreddit} • ${new Date(doc.created_utc).toLocaleDateString()} • u/${doc.author}</div>
                                    <div>${doc.title}</div>
                                    <div class="small mt-1">Topic relevance: ${(doc.topic_probability * 100).toFixed(1)}%</div>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
        
        topicsContainer.appendChild(topicCard);
    }
    
    // If there are more topics, add a message
    if (data.topics.length > visibleTopics) {
        const moreTopicsMessage = document.createElement('div');
        moreTopicsMessage.className = 'alert alert-info';
        moreTopicsMessage.textContent = `Showing ${visibleTopics} of ${data.topics.length} topics for performance reasons. Adjust the number of topics and click "Update Topics" to see different topics.`;
        topicsContainer.appendChild(moreTopicsMessage);
    }
    
    // PERFORMANCE OPTIMIZATION: Lazy-load word clouds with IntersectionObserver
    // Only render the word clouds when they become visible
    if ('IntersectionObserver' in window) {
        const cloudObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const targetId = entry.target.id;
                    const topicId = targetId.split('-').pop();
                    const topic = data.topics.find(t => t.topic_id == topicId);
                    
                    if (topic) {
                        renderWordCloud(topicId, topic.word_weight_pairs.slice(0, 20));
                        observer.unobserve(entry.target);
                    }
                }
            });
        }, {
            threshold: 0.1
        });
        
        // Observe all word clouds
        for (let i = 0; i < visibleTopics; i++) {
            const cloudContainer = document.getElementById(`topic-cloud-${data.topics[i].topic_id}`);
            if (cloudContainer) {
                cloudObserver.observe(cloudContainer);
            }
        }
    } else {
        // Fallback for browsers without IntersectionObserver
        // Render word clouds with a delay between each
        for (let i = 0; i < visibleTopics; i++) {
            const topicId = data.topics[i].topic_id;
            setTimeout(() => {
                renderWordCloud(topicId, data.topics[i].word_weight_pairs.slice(0, 20));
            }, i * 300); // Stagger loading
        }
    }
    
    // Helper function to render a word cloud
    function renderWordCloud(topicId, wordWeightPairs) {
        const cloudContainer = document.getElementById(`topic-cloud-${topicId}`);
        if (!cloudContainer) return;
        
        // Clear loading indicator
        cloudContainer.innerHTML = '';
        
        const width = cloudContainer.clientWidth;
        const height = cloudContainer.clientHeight || 200;
        
        // Process words data
        const wordCloudData = wordWeightPairs.map(pair => ({
            text: pair.word,
            size: 14 + (pair.weight * 1.5),
            weight: pair.weight
        }));
        
        // PERFORMANCE OPTIMIZATION: Simplified word cloud with fewer words
        // Create layout with fewer words and simplified options
        const layout = d3.layout.cloud()
            .size([width, height])
            .words(wordCloudData)
            .padding(3)
            .rotate(() => 0) // No rotation for better performance
            .font('Arial')
            .fontSize(d => d.size)
            .on('end', words => {
                // Color scale
                const color = d3.scaleLinear()
                    .domain([0, 50, 100])
                    .range(['#6c757d', '#0d6efd', '#dc3545']);
                
                d3.select(`#topic-cloud-${topicId}`)
                    .append('svg')
                    .attr('width', width)
                    .attr('height', height)
                    .append('g')
                    .attr('transform', `translate(${width/2},${height/2})`)
                    .selectAll('text')
                    .data(words)
                    .enter()
                    .append('text')
                    .style('font-size', d => `${d.size}px`)
                    .style('font-family', 'Arial')
                    .style('font-weight', d => d.weight > 20 ? 'bold' : 'normal')
                    .style('fill', d => color(d.weight))
                    .attr('text-anchor', 'middle')
                    .attr('transform', d => `translate(${d.x},${d.y})`)
                    .text(d => d.text)
                    .append('title')
                    .text(d => {
                        // Safe handling of weight property to avoid the toFixed error
                        const weight = typeof d.weight === 'number' ? d.weight.toFixed(1) : (d.weight || 0);
                        return `${d.text}: ${weight}%`;
                    });
            });
        
        layout.start();
    }
}

// Coordinated Behavior Analysis - Enhanced version
async function updateCoordinatedBehavior() {
    try {
        const timeWindow = document.getElementById('time-window').value;
        const similarityThreshold = document.getElementById('similarity-threshold').value;
        const query = activeQuery; // Use the active query for filtering
        
        const response = await fetch(`/api/coordinated?time_window=${timeWindow}&similarity_threshold=${similarityThreshold}&query=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        // Update stats with enhanced metrics
        const metrics = data.metrics || { 
            total_groups: 0, 
            total_authors: 0 
        };
        
        // Safely update DOM elements after checking they exist
        const totalGroupsEl = document.getElementById('total-groups');
        if (totalGroupsEl) totalGroupsEl.textContent = metrics.total_groups;
        
        const totalAuthorsEl = document.getElementById('total-authors');
        if (totalAuthorsEl) totalAuthorsEl.textContent = metrics.total_authors;
        
        // Create enhanced metrics display
        const statsContainer = document.getElementById('coordinated-stats');
        if (!statsContainer) {
            console.warn('Coordinated stats container not found');
        } else {
            statsContainer.innerHTML = `
                <div class="row mb-3">
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-value">${metrics.total_groups}</div>
                            <div class="stat-label">Coordinated Groups</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-value">${metrics.total_authors}</div>
                            <div class="stat-label">Authors Involved</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-value">${metrics.avg_group_size ? metrics.avg_group_size.toFixed(1) : '-'}</div>
                            <div class="stat-label">Avg Group Size</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-value">${metrics.authors_involved_percentage ? metrics.authors_involved_percentage.toFixed(1) + '%' : '-'}</div>
                            <div class="stat-label">% of All Authors</div>
                        </div>
                    </div>
                </div>
                <div class="alert alert-info">
                    <i class="bi bi-info-circle-fill"></i> 
                    Analysis performed with ${metrics.time_window_seconds}s time window and ${metrics.similarity_threshold} similarity threshold.
                    Network density: ${metrics.density ? (metrics.density * 100).toFixed(2) + '%' : 'N/A'}.
                </div>
            `;
        }
        
        // Safely clear previous visualizations
        const coordGraphEl = document.getElementById('coordinated-graph');
        const coordGroupsEl = document.getElementById('coordinated-groups');
        
        if (coordGraphEl) d3.select('#coordinated-graph').html('');
        if (coordGroupsEl) d3.select('#coordinated-groups').html('');
        
        // Validate data structure to avoid errors
        if (!data.network || !data.network.nodes || !data.network.nodes.length) {
            if (coordGraphEl) coordGraphEl.innerHTML = '<div class="alert alert-info">No coordinated behavior detected with current parameters.</div>';
            if (coordGroupsEl) coordGroupsEl.innerHTML = '<div class="alert alert-info">Try adjusting the time window or similarity threshold parameters.</div>';
            return;
        }
        
        // Only proceed with visualization if elements exist
        if (!coordGraphEl) {
            console.warn('Coordinated graph container not found');
            return;
        }
        
        // 1. Render the enhanced network graph
        const width = document.getElementById('coordinated-graph').clientWidth;
        const height = 500;
        
        const svg = d3.select('#coordinated-graph')
            .append('svg')
            .attr('width', width)
            .attr('height', height);
        
        // Add a background rectangle for zoom/pan interactions
        svg.append('rect')
            .attr('width', width)
            .attr('height', height)
            .attr('fill', 'white');
            
        // Create a group for the network
        const g = svg.append('g');
        
        // Define color scale for the network - color by posts count
        const nodeColor = d3.scaleLinear()
            .domain([1, d3.max(data.network.nodes, d => d.posts_count || 1)])
            .range(['#6c757d', '#dc3545']);
        
        // Define node size scale based on involvement in coordinated groups
        const nodeSize = d3.scaleLinear()
            .domain([1, d3.max(data.network.nodes, d => d.coordinated_groups_count || 1)])
            .range([5, 15]);
        
        // Define edge width scale based on weight
        const linkWidth = d3.scaleLinear()
            .domain([1, d3.max(data.network.links, d => d.weight || 1)])
            .range([1, 5]);
        
        // Create simulation with improved forces
        const simulation = d3.forceSimulation(data.network.nodes)
            .force('link', d3.forceLink(data.network.links)
                .id(d => d.id)
                .distance(d => 100 / (d.weight || 1)))
            .force('charge', d3.forceManyBody()
                .strength(d => -50 - (d.coordinated_groups_count || 1) * 10))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide(d => nodeSize(d.coordinated_groups_count || 1) + 2));
        
        // Add zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });
        
        svg.call(zoom);
        
        // Draw links with width based on weight
        const link = g.append('g')
            .selectAll('line')
            .data(data.network.links)
            .enter()
            .append('line')
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', d => linkWidth(d.weight || 1));
        
        // Draw nodes with size and color based on metrics
        const node = g.append('g')
            .selectAll('circle')
            .data(data.network.nodes)
            .enter()
            .append('circle')
            .attr('r', d => nodeSize(d.coordinated_groups_count || 1))
            .attr('fill', d => nodeColor(d.posts_count || 1))
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));
        
        // Add tooltips to nodes with more information
        node.append('title')
            .text(d => `User: ${d.id}\nPosts: ${d.posts_count || 'unknown'}\nInvolved in ${d.coordinated_groups_count || 0} coordinated groups`);
        
        // Add labels to nodes but only for ones with high involvement
        g.append('g')
            .selectAll('text')
            .data(data.network.nodes.filter(d => (d.coordinated_groups_count || 0) > 1))
            .enter()
            .append('text')
            .attr('dx', 12)
            .attr('dy', '.35em')
            .text(d => d.id)
            .style('font-size', '10px')
            .style('pointer-events', 'none');
        
        // Add legend for node size and color
        const legend = svg.append('g')
            .attr('transform', 'translate(20, 20)');
        
        legend.append('text')
            .attr('x', 0)
            .attr('y', 0)
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .text('Network Legend');
        
        // Node size legend
        legend.append('text')
            .attr('x', 0)
            .attr('y', 20)
            .style('font-size', '10px')
            .text('Node size = Coordination frequency');
        
        // Node color legend
        legend.append('text')
            .attr('x', 0)
            .attr('y', 35)
            .style('font-size', '10px')
            .text('Node color = Number of posts');
        
        // Link width legend
        legend.append('text')
            .attr('x', 0)
            .attr('y', 50)
            .style('font-size', '10px')
            .text('Link width = Coordination strength');
        
        // Update positions on simulation tick
        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
            
            node
                .attr('cx', d => d.x = Math.max(nodeSize(d.coordinated_groups_count || 1), Math.min(width - nodeSize(d.coordinated_groups_count || 1), d.x)))
                .attr('cy', d => d.y = Math.max(nodeSize(d.coordinated_groups_count || 1), Math.min(height - nodeSize(d.coordinated_groups_count || 1), d.y)));
            
            g.selectAll('text')
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });
        
        // Drag functions
        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }
        
        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }
        
        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }
        
        // 2. Render the enhanced coordinated groups panel
        const groupsContainer = d3.select('#coordinated-groups');
        
        // Create a searchable, sortable table for the groups
        const tableContainer = groupsContainer.append('div')
            .attr('class', 'table-responsive');
        
        const tableHeader = `
            <div class="mb-3">
                <input type="text" class="form-control" id="group-search" placeholder="Search in coordinated groups...">
            </div>
            <table class="table table-sm table-hover">
                <thead>
                    <tr>
                        <th scope="col" class="sortable" data-sort="id">Group ID</th>
                        <th scope="col" class="sortable" data-sort="size">Size</th>
                        <th scope="col" class="sortable" data-sort="authors">Authors</th>
                        <th scope="col" class="sortable" data-sort="timespan">Time Span</th>
                        <th scope="col">Details</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        const tableFooter = `
                </tbody>
            </table>
        `;
        
        let tableRows = '';
        data.groups.forEach(group => {
            const authors = new Set(group.posts.map(p => p.author));
            const timeSpanSeconds = group.time_span || 0;
            const timeSpanFormatted = timeSpanSeconds < 60 
                ? `${timeSpanSeconds.toFixed(0)}s` 
                : `${(timeSpanSeconds/60).toFixed(1)}m`;
            
            tableRows += `
                <tr>
                    <td>${group.group_id}</td>
                    <td>${group.size}</td>
                    <td>${authors.size}</td>
                    <td>${timeSpanFormatted}</td>
                    <td><button class="btn btn-sm btn-outline-primary view-group" data-group-id="${group.group_id}">View</button></td>
                </tr>
            `;
        });
        
        tableContainer.html(tableHeader + tableRows + tableFooter);
        
        // Add group detail modal
        const modalContainer = d3.select('body')
            .append('div')
            .attr('class', 'modal fade')
            .attr('id', 'group-detail-modal')
            .attr('tabindex', '-1')
            .html(`
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Group Details</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body" id="group-detail-content">
                        </div>
                    </div>
                </div>
            `);
        
        // Add event listeners to view buttons after they're in the DOM
        setTimeout(() => {
            document.querySelectorAll('.view-group').forEach(button => {
                button.addEventListener('click', () => {
                    const groupId = parseInt(button.getAttribute('data-group-id'));
                    const group = data.groups.find(g => g.group_id === groupId);
                    
                    if (group) {
                        // Populate modal with group details
                        document.getElementById('group-detail-content').innerHTML = `
                            <div class="group-metadata mb-3">
                                <div class="row">
                                    <div class="col-md-3">
                                        <div class="card">
                                            <div class="card-body text-center">
                                                <div class="h3">${group.size}</div>
                                                <div class="small text-muted">Posts</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-3">
                                        <div class="card">
                                            <div class="card-body text-center">
                                                <div class="h3">${group.unique_authors}</div>
                                                <div class="small text-muted">Authors</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-3">
                                        <div class="card">
                                            <div class="card-body text-center">
                                                <div class="h3">${group.shared_links_count || 0}</div>
                                                <div class="small text-muted">Shared Links</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-3">
                                        <div class="card">
                                            <div class="card-body text-center">
                                                <div class="h3">${(group.time_span/60).toFixed(1)}</div>
                                                <div class="small text-muted">Minutes Span</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <h6>Posts in this group:</h6>
                            <div class="posts-container">
                                ${group.posts.map((post, i) => `
                                    <div class="card mb-2 ${i > 0 ? 'border-primary' : ''}">
                                        <div class="card-header d-flex justify-content-between align-items-center ${i > 0 ? 'bg-light' : ''}">
                                            <span>u/${post.author}</span>
                                            <span class="small text-muted">${new Date(post.created_utc).toLocaleString()}</span>
                                        </div>
                                        <div class="card-body">
                                            <h6>${post.title}</h6>
                                            ${post.selftext ? `<p class="small">${post.selftext}</p>` : ''}
                                            ${post.similarity_score ? `
                                                <div class="d-flex justify-content-between small text-muted">
                                                    <span>Similarity to original: ${(post.similarity_score * 100).toFixed(1)}%</span>
                                                    ${post.shared_links ? '<span class="badge bg-primary">Shared Links</span>' : ''}
                                                    ${post.shared_hashtags ? '<span class="badge bg-secondary">Shared Hashtags</span>' : ''}
                                                </div>
                                            ` : ''}
                                        </div>
                                        <div class="card-footer">
                                            <a href="${post.url}" target="_blank" class="btn btn-sm btn-outline-secondary">View Original</a>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `;
                        
                        // Show the modal
                        const modal = new bootstrap.Modal(document.getElementById('group-detail-modal'));
                        modal.show();
                    }
                });
            });
            
            // Add search functionality
            const searchInput = document.getElementById('group-search');
            if (searchInput) {
                searchInput.addEventListener('input', function() {
                    const searchTerm = this.value.toLowerCase();
                    document.querySelectorAll('#coordinated-groups tbody tr').forEach(row => {
                        const text = row.textContent.toLowerCase();
                        row.style.display = text.includes(searchTerm) ? '' : 'none';
                    });
                });
            }
            
            // Add sorting functionality
            document.querySelectorAll('.sortable').forEach(header => {
                header.addEventListener('click', function() {
                    const sortBy = this.getAttribute('data-sort');
                    const tbody = document.querySelector('#coordinated-groups tbody');
                    const rows = Array.from(tbody.querySelectorAll('tr'));
                    
                    // Sort rows
                    rows.sort((a, b) => {
                        const aVal = a.children[Array.from(this.parentNode.children).indexOf(this)].textContent;
                        const bVal = b.children[Array.from(this.parentNode.children).indexOf(this)].textContent;
                        
                        // Check if sorting numbers or text
                        if (!isNaN(aVal) && !isNaN(bVal)) {
                            return Number(aVal) - Number(bVal);
                        }
                        return aVal.localeCompare(bVal);
                    });
                    
                    // Toggle sort direction
                    if (this.classList.contains('asc')) {
                        rows.reverse();
                        this.classList.remove('asc');
                        this.classList.add('desc');
                    } else {
                        this.classList.remove('desc');
                        this.classList.add('asc');
                    }
                    
                    // Clear sort indicators on other headers
                    document.querySelectorAll('.sortable').forEach(h => {
                        if (h !== this) {
                            h.classList.remove('asc', 'desc');
                        }
                    });
                    
                    // Update DOM
                    tbody.innerHTML = '';
                    rows.forEach(row => tbody.appendChild(row));
                });
            });
        }, 100);
    } catch (error) {
        console.error('Error updating coordinated behavior:', error);
    }
}

// Data storytelling function - generates a narrative from visualizations
async function generateDataStory(query) {
    try {
        console.log('Generating data story for query:', query);
        
        // Collect data from various endpoints to build the story
        const [summaryData, timeseriesData, topContributors, topicsData, coordinatedData, wordsData] = await Promise.all([
            fetch(`/api/ai_summary?query=${encodeURIComponent(query)}`).then(r => r.json()).catch(() => null),
            fetch(`/api/timeseries?query=${encodeURIComponent(query)}`).then(r => r.json()).catch(() => []),
            fetch(`/api/top_contributors?query=${encodeURIComponent(query)}&limit=5`).then(r => r.json()).catch(() => []),
            fetch(`/api/topics?query=${encodeURIComponent(query)}&n_topics=3`).then(r => r.json()).catch(() => ({topics: []})),
            fetch(`/api/coordinated?query=${encodeURIComponent(query)}&time_window=3600&similarity_threshold=0.7`).then(r => r.json()).catch(() => null),
            fetch(`/api/common_words?query=${encodeURIComponent(query)}&limit=20`).then(r => r.json()).catch(() => [])
        ]);
        
        // Get the existing data story container
        const storyContainer = document.getElementById('data-story');
        if (!storyContainer) {
            console.error('Data story container not found');
            return;
        }
        
        // Process timeseries data for visualization
        let timelineHtml = '';
        let peakDays = [];
        let trend = "fluctuating";
        let daysDiff = 0;
        
        if (timeseriesData && timeseriesData.length > 0) {
            // Sort by date
            timeseriesData.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // Find peak days
            peakDays = [...timeseriesData]
                .sort((a, b) => b.count - a.count)
                .slice(0, 3)
                .map(d => ({date: new Date(d.date).toLocaleDateString(), count: d.count, rawDate: d.date}));
            
            // Calculate trend
            if (timeseriesData.length > 5) {
                const firstHalf = timeseriesData.slice(0, Math.floor(timeseriesData.length/2));
                const secondHalf = timeseriesData.slice(Math.floor(timeseriesData.length/2));
                
                const firstHalfAvg = firstHalf.reduce((sum, item) => sum + item.count, 0) / firstHalf.length;
                const secondHalfAvg = secondHalf.reduce((sum, item) => sum + item.count, 0) / secondHalf.length;
                
                if (secondHalfAvg > firstHalfAvg * 1.2) {
                    trend = "increasing";
                } else if (secondHalfAvg < firstHalfAvg * 0.8) {
                    trend = "decreasing";
                }
            }
            
            // Calculate timespan
            const firstDate = new Date(timeseriesData[0].date);
            const lastDate = new Date(timeseriesData[timeseriesData.length - 1].date);
            daysDiff = Math.round((lastDate - firstDate) / (1000 * 60 * 60 * 24));
            
            // Create mini timeline visualization
            timelineHtml = `
                <div class="mini-timeline mb-3">
                    <div class="timeline-header d-flex justify-content-between">
                        <span>${firstDate.toLocaleDateString()}</span>
                        <span>${lastDate.toLocaleDateString()}</span>
                    </div>
                    <div class="timeline-body position-relative" style="height: 60px; background-color: #f8f9fa; border-radius: 4px;">
                        ${timeseriesData.map(point => {
                            const date = new Date(point.date);
                            const isPeak = peakDays.some(p => p.rawDate === point.date);
                            const left = ((date - firstDate) / (lastDate - firstDate) * 100).toFixed(2);
                            const height = Math.max(10, Math.min(50, (point.count / Math.max(...timeseriesData.map(d => d.count))) * 50));
                            return `
                                <div class="timeline-point position-absolute" 
                                     style="left: ${left}%; bottom: 0; width: 4px; height: ${height}px; 
                                            background-color: ${isPeak ? '#dc3545' : '#0d6efd'};" 
                                     title="${date.toLocaleDateString()}: ${point.count} posts">
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }
        
        // Process topic data for better visualization
        let topicsHtml = '';
        let topicTrends = [];
        
        if (topicsData && topicsData.topics && topicsData.topics.length > 0) {
            // Extract the top topics
            const topics = topicsData.topics.slice(0, 3);
            
            // Process topic evolution if available
            if (topicsData.topic_evolution) {
                for (let i = 0; i < topics.length; i++) {
                    const topicKey = `topic_${i}`;
                    if (topicsData.topic_evolution[topicKey]) {
                        const evolution = topicsData.topic_evolution[topicKey];
                        const dates = Object.keys(evolution).sort();
                        
                        if (dates.length > 1) {
                            const firstCount = evolution[dates[0]];
                            const lastCount = evolution[dates[dates.length - 1]];
                            const change = ((lastCount - firstCount) / firstCount * 100).toFixed(1);
                            
                            topicTrends.push({
                                topicId: i,
                                words: topics[i].top_words.slice(0, 3).join(', '),
                                change: change,
                                trend: change > 20 ? 'rising' : change < -20 ? 'falling' : 'stable'
                            });
                        }
                    }
                }
            }
            
            // Create topic visualization
            topicsHtml = `
                <div class="topics-summary mb-3">
                    <div class="row">
                        ${topics.map((topic, i) => `
                            <div class="col-md-4 mb-2">
                                <div class="topic-card p-2 border rounded" style="background-color: ${['#f8edeb', '#eaf4f4', '#f4f3ee'][i % 3]};">
                                    <h6 class="topic-title">Theme ${i+1}</h6>
                                    <div class="topic-keywords">
                                        ${topic.word_weight_pairs.slice(0, 7).map(pair => 
                                            `<span class="badge rounded-pill text-bg-${['primary', 'success', 'secondary', 'info', 'dark'][Math.floor(Math.random() * 5)]}" 
                                                  style="font-size: ${Math.max(0.7, Math.min(1.1, 0.7 + pair.weight/100))}rem;">
                                                ${pair.word}
                                            </span>`
                                        ).join(' ')}
                                    </div>
                                    ${topic.representative_docs && topic.representative_docs.length > 0 ? 
                                        `<div class="topic-example mt-2 small">
                                            <em>"${topic.representative_docs[0].title}"</em>
                                         </div>` : ''}
                                    ${topicTrends.find(t => t.topicId === i) ? 
                                        `<div class="trend-indicator mt-1 small ${topicTrends.find(t => t.topicId === i).trend === 'rising' ? 'text-success' : 
                                                                                  topicTrends.find(t => t.topicId === i).trend === 'falling' ? 'text-danger' : 'text-secondary'}">
                                            <i class="bi bi-${topicTrends.find(t => t.topicId === i).trend === 'rising' ? 'arrow-up-circle-fill' : 
                                                             topicTrends.find(t => t.topicId === i).trend === 'falling' ? 'arrow-down-circle-fill' : 'dash-circle'}"></i>
                                            ${topicTrends.find(t => t.topicId === i).change}%
                                         </div>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        // Process coordinated behavior data
        let coordinatedHtml = '';
        let significantGroups = [];
        
        if (coordinatedData && coordinatedData.groups && coordinatedData.groups.length > 0) {
            // Get the most significant coordination groups
            significantGroups = coordinatedData.groups
                .sort((a, b) => b.size - a.size)
                .slice(0, 2);
                
            if (significantGroups.length > 0) {
                coordinatedHtml = `
                    <div class="coordinated-summary mb-3">
                        <div class="row">
                            ${significantGroups.map((group, i) => `
                                <div class="col-md-6 mb-2">
                                    <div class="coordination-card p-2 border border-warning rounded" style="background-color: #fff8e6;">
                                        <h6 class="coordination-title">
                                            <i class="bi bi-people-fill"></i> Coordinated Group ${i+1}
                                            <span class="badge rounded-pill text-bg-warning">${group.size} posts</span>
                                        </h6>
                                        <div class="coordination-meta d-flex justify-content-between small text-secondary mb-2">
                                            <span>${group.unique_authors} authors</span>
                                            <span>Timespan: ${Math.round(group.time_span / 60)} minutes</span>
                                        </div>
                                        <div class="coordination-example p-2 small bg-light rounded">
                                            <div class="d-flex justify-content-between">
                                                <span class="fw-bold">${group.posts[0].author}</span>
                                                <span class="text-secondary">${new Date(group.posts[0].created_utc).toLocaleTimeString()}</span>
                                            </div>
                                            <div class="mt-1">${group.posts[0].title}</div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }
        
        // Process word data for keyword visualization
        let keywordsHtml = '';
        
        if (wordsData && wordsData.length > 0) {
            // Get the top 12 words
            const topWords = wordsData.slice(0, 12);
            const maxCount = Math.max(...topWords.map(w => w.count));
            
            keywordsHtml = `
                <div class="keywords-cloud mb-3 text-center" style="line-height: 1.8;">
                    ${topWords.map(word => {
                        const size = Math.max(0.9, Math.min(1.8, 0.9 + (word.count / maxCount) * 1.0));
                        const opacity = Math.max(0.6, Math.min(1.0, 0.6 + (word.count / maxCount) * 0.4));
                        return `
                            <span class="px-1" style="font-size: ${size}rem; opacity: ${opacity};">
                                ${word.word}
                            </span>
                        `;
                    }).join('')}
                </div>
            `;
        }
        
        // Build the narrative components with enhanced visualization
        let storyHtml = `
            <div class="card-body">
                <div class="story-header mb-4">
                    <h4 class="story-title">The <span class="text-primary">${query}</span> Narrative</h4>
                    <div class="story-subtitle text-secondary">
                        ${summaryData && summaryData.metrics ? 
                          `Based on analysis of ${summaryData.metrics.total_posts} posts from ${summaryData.metrics.unique_authors} authors` : 
                          `Analysis of social media conversations`}
                    </div>
                </div>
                
                <div class="story-section mb-4">
                    <h5 class="section-title d-flex align-items-center">
                        <i class="bi bi-clock-history me-2"></i> Timeline Analysis
                    </h5>
                    <div class="section-content">
                        ${timelineHtml}
                        
                        <p>
                            Discussion about <span class="fw-bold">"${query}"</span> shows a 
                            <span class="badge rounded-pill text-bg-${trend === 'increasing' ? 'success' : trend === 'decreasing' ? 'danger' : 'secondary'}">
                                ${trend}
                            </span> pattern over ${daysDiff > 0 ? `${daysDiff} days` : 'the analyzed period'}.
                            
                            ${peakDays.length > 0 ? `
                                <span class="d-block mt-2">
                                    <i class="bi bi-graph-up"></i> Peak activity occurred on 
                                    <span class="fw-bold">${peakDays[0].date}</span> with 
                                    <span class="badge rounded-pill text-bg-danger">${peakDays[0].count} posts</span>.
                                </span>
                            ` : ''}
                            
                            ${peakDays.length > 1 ? `
                                <span class="d-block mt-1">
                                    <i class="bi bi-arrow-up-right"></i> Other notable spikes: 
                                    ${peakDays.slice(1).map(d => `
                                        <span class="fw-bold">${d.date}</span> 
                                        <span class="badge rounded-pill text-bg-secondary">${d.count}</span>
                                    `).join(', ')}
                                </span>
                            ` : ''}
                        </p>
                    </div>
                </div>
                
                <div class="story-section mb-4">
                    <h5 class="section-title d-flex align-items-center">
                        <i class="bi bi-chat-square-text me-2"></i> Key Themes & Topics
                    </h5>
                    <div class="section-content">
                        ${topicsHtml ? topicsHtml : 
                          `<p class="text-muted"><i class="bi bi-exclamation-circle"></i> Topic analysis not available for this query.</p>`}
                        
                        <div class="keywords-section mt-3">
                            <h6>Key Terms</h6>
                            ${keywordsHtml ? keywordsHtml :
                              `<p class="text-muted small">No keyword data available.</p>`}
                        </div>
                    </div>
                </div>
                
                <div class="story-section mb-4">
                    <h5 class="section-title d-flex align-items-center">
                        <i class="bi bi-people me-2"></i> Community Dynamics
                    </h5>
                    <div class="section-content">
                        ${topContributors && topContributors.length > 0 ? `
                            <div class="voices-section mb-3">
                                <h6>Key Voices</h6>
                                <div class="row">
                                    ${topContributors.slice(0, 3).map((contributor, i) => `
                                        <div class="col-md-4 mb-2">
                                            <div class="contributor-card p-2 text-center border rounded">
                                                <div class="contributor-icon mb-1">
                                                    <i class="bi bi-person-circle" style="font-size: 1.5rem; color: ${['#0d6efd', '#6610f2', '#6f42c1'][i % 3]};"></i>
                                                </div>
                                                <div class="contributor-name fw-bold">${contributor.author}</div>
                                                <div class="contributor-stat small">${contributor.count} posts</div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${coordinatedHtml ? `
                            <div class="coordination-section mt-3">
                                <h6>Coordinated Behavior</h6>
                                ${coordinatedHtml}
                                <p class="small text-secondary">
                                    <i class="bi bi-info-circle"></i>
                                    Coordinated posting may indicate organized campaigns or natural responses to significant events.
                                </p>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="story-section mb-4">
                    <h5 class="section-title d-flex align-items-center">
                        <i class="bi bi-lightbulb me-2"></i> Insights & Case Studies
                    </h5>
                    <div class="section-content">
                        ${peakDays && peakDays.length > 0 ? `
                            <div class="case-study p-3 mb-3 border-start border-4 border-primary" style="background-color: #f8f9fa;">
                                <h6 class="case-study-title">
                                    Case Study: Activity Spike on ${peakDays[0].date}
                                </h6>
                                <p>
                                    On ${peakDays[0].date}, conversation about <span class="fw-bold">"${query}"</span>
                                    reached its peak with ${peakDays[0].count} posts.
                                    
                                    ${topContributors && topContributors.length > 1 ? `
                                        <span class="d-block mt-2">
                                            <i class="bi bi-person-check"></i> Notable contributors: 
                                            ${topContributors.slice(0, 2).map(c => `<span class="fw-bold">${c.author}</span>`).join(' and ')}
                                        </span>
                                    ` : ''}
                                    
                                    ${topicsData && topicsData.topics && topicsData.topics.length > 0 ? `
                                        <span class="d-block mt-2">
                                            <i class="bi bi-chat-square-text"></i> Key terms: 
                                            ${topicsData.topics[0].top_words.slice(0, 3).join(', ')}
                                        </span>
                                    ` : ''}
                                </p>
                            </div>
                        ` : ''}
                        
                        <div class="implications mt-3">
                            <h6>Key Takeaways</h6>
                            <ul class="implications-list">
                                ${trend !== 'fluctuating' ? `
                                    <li>
                                        The <span class="fw-bold ${trend === 'increasing' ? 'text-success' : 'text-danger'}">${trend}</span> pattern suggests
                                        ${trend === 'increasing' ? 
                                          'growing relevance that may continue to gain attention.' : 
                                          'decreasing interest as the topic becomes less central to discourse.'}
                                    </li>
                                ` : ''}
                                
                                ${topContributors && topContributors.length > 0 ? `
                                    <li>
                                        Community dynamics show 
                                        ${topContributors.length < 10 ? 
                                          'a centralized conversation dominated by a few key voices.' :
                                          'diverse participation across many contributors.'}
                                    </li>
                                ` : ''}
                                
                                ${coordinatedData && coordinatedData.groups && coordinatedData.groups.length > 0 ? `
                                    <li>
                                        ${coordinatedData.groups.length > 3 ? 'Significant' : 'Some'} coordinated posting patterns
                                        suggest potential organized activity around this topic.
                                    </li>
                                ` : ''}
                                
                                ${topicsData && topicTrends && topicTrends.length > 0 ? `
                                    <li>
                                        Theme evolution shows that discussion about
                                        "${topicTrends.find(t => t.trend === 'rising')?.words || topicsData.topics[0].top_words.slice(0, 3).join(', ')}"
                                        ${topicTrends.find(t => t.trend === 'rising') ? 'is gaining traction.' : 'remains prominent.'}
                                    </li>
                                ` : ''}
                            </ul>
                        </div>
                    </div>
                </div>
                
                <div class="story-footer mt-4 pt-3 border-top">
                    <p class="small text-secondary">
                        This data story was automatically generated based on analysis of posts containing "${query}".
                        For more detailed analysis, explore the visualization tabs above.
                    </p>
                    <button class="btn btn-sm btn-outline-primary" onclick="window.print()">
                        <i class="bi bi-printer"></i> Print Story
                    </button>
                </div>
            </div>
        `;
        
        // Add the story to the container
        storyContainer.innerHTML = storyHtml;
        
        // Add custom CSS for the data story
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            .mini-timeline .timeline-point:hover {
                height: 55px !important;
                width: 6px !important;
                transition: all 0.2s ease;
                z-index: 10;
            }
            .story-title {
                font-weight: 600;
            }
            .section-title {
                font-weight: 600;
                color: #495057;
                margin-bottom: 15px;
            }
            .topic-card, .contributor-card, .coordination-card {
                transition: all 0.2s ease;
            }
            .topic-card:hover, .contributor-card:hover, .coordination-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            }
            .keywords-cloud span {
                display: inline-block;
                transition: all 0.2s ease;
            }
            .keywords-cloud span:hover {
                transform: scale(1.2);
                color: #0d6efd;
            }
            @media print {
                .dashboard-header, .controls, .nav-tabs, .container-fluid > *:not(#data-story) {
                    display: none !important;
                }
                .story-footer button {
                    display: none;
                }
                #data-story {
                    box-shadow: none !important;
                    border: none !important;
                }
            }
        `;
        document.head.appendChild(styleElement);
    } catch (error) {
        console.error('Error generating data story:', error);
    }
} 

// Add CSS for section loading indicators
document.addEventListener('DOMContentLoaded', function() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .section-loading {
            padding: 20px;
            text-align: center;
            color: #6c757d;
            background-color: #f8f9fa;
            border-radius: 4px;
        }
        .section-loading .spinner-border {
            margin-right: 10px;
        }
    `;
    document.head.appendChild(styleElement);
});