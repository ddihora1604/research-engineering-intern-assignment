/**
 * Social Media Analysis Dashboard - Frontend JavaScript
 * ===================================================
 * 
 * This file contains all the client-side functionality for the Social Media Analysis Dashboard.
 * It handles UI interaction, API calls, data processing, and visualization rendering.
 * 
 * Main Components:
 * ----------------
 * 1. Main UI control handlers:
 *    - Search query processing
 *    - Tab management
 *    - Showing/hiding loading indicators
 *    - Parameter controls (sliders, date ranges)
 * 
 * 2. Data fetching and processing:
 *    - API calls to backend endpoints
 *    - Data transformation for visualizations
 *    - Progressive loading of heavy analyses
 * 
 * 3. Visualization modules:
 *    - Time series graph (post frequency over time)
 *    - Network visualization (user interactions)
 *    - Topic analysis (LDA topic models)
 *    - Coordinated behavior detection
 *    - Word cloud generation
 *    - Key metrics and statistics
 * 
 * 4. Data storytelling functionality:
 *    - Narrative generation from analytical results
 *    - Key insights extraction
 *    - Visual elements to enhance understanding
 * 
 * The dashboard follows a modular design where each analytical component 
 * operates independently but can be integrated into a cohesive data story.
 * Visualizations are rendered using D3.js and other specialized libraries.
 */

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

// Function to get dynamic description for a section
async function getDynamicDescription(section, query, context = {}) {
    try {
        // Convert context object to JSON string
        const contextStr = JSON.stringify(context);
        
        // Make API call to get dynamic description
        const response = await fetch(`/api/dynamic_description?section=${section}&query=${encodeURIComponent(query)}&data_context=${encodeURIComponent(contextStr)}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch description: ${response.status}`);
        }
        
        const data = await response.json();
        return data.description || "This section analyzes data based on your query.";
    } catch (error) {
        console.error(`Error getting dynamic description for ${section}:`, error);
        return "This section analyzes data based on your query.";
    }
}

// Function to update section description
async function updateSectionDescription(sectionId, descriptionElementSelector, context = {}) {
    if (!activeQuery) return; // Don't update if no query is active
    
    try {
        const descriptionElement = document.querySelector(descriptionElementSelector);
        if (!descriptionElement) return;
        
        // Map of section IDs to user-friendly section titles
        const sectionTitles = {
            'ai_insights': 'Social Media Insights',
            'data_story': 'Comprehensive Data Story',
            'word_cloud': 'Word Cloud',
            'contributors': 'Top Contributors',
            'metrics': 'Key Metrics',
            'timeseries': 'Time Series Analysis',
            'topic_evolution': 'Topic Evolution',
            'network': 'User Network',
            'topics': 'Topic Analysis',
            'semantic_map': 'Semantic Map',
            'coordinated': 'Coordinated Behavior',
            'coordinated_groups': 'Coordinated Content Groups',
            'community_distribution': 'Community Distribution'
        };
        
        const sectionTitle = sectionTitles[sectionId] || sectionId.replace(/_/g, ' ');
        
        // Show loading state with specific section title
        descriptionElement.innerHTML = `
            <i class="bi bi-info-circle"></i>
            <div class="description-content">
                <div class="d-flex align-items-center">
                    <span class="spinner-border spinner-border-sm text-primary me-2" role="status"></span>
                    <h4 class="section-heading mb-0">Loading ${sectionTitle}...</h4>
                </div>
            </div>
        `;
        
        // Get dynamic description
        const description = await getDynamicDescription(sectionId, activeQuery, context);
        
        // Update the description element - the description already contains HTML formatting
        descriptionElement.innerHTML = description;
        
        // Add the info icon if it's not already included
        if (!descriptionElement.querySelector('.bi-info-circle')) {
            descriptionElement.insertAdjacentHTML('afterbegin', '<i class="bi bi-info-circle me-2"></i>');
        }
        
        // Apply some additional styling to ensure good presentation
        const descriptionContent = descriptionElement.querySelector('.description-content');
        if (descriptionContent) {
            // Add styles for better readability
            descriptionContent.querySelectorAll('h4').forEach(heading => {
                heading.classList.add('section-heading', 'mb-3', 'text-primary');
            });
            
            descriptionContent.querySelectorAll('h5').forEach(subheading => {
                subheading.classList.add('subsection-heading', 'mb-2', 'mt-3', 'text-secondary');
            });
            
            descriptionContent.querySelectorAll('ul, ol').forEach(list => {
                list.classList.add('my-2');
            });
            
            descriptionContent.querySelectorAll('li').forEach(item => {
                item.classList.add('mb-1');
            });
            
            descriptionContent.querySelectorAll('p').forEach(paragraph => {
                paragraph.classList.add('mb-2');
            });
        }
    } catch (error) {
        console.error(`Error updating description for ${sectionId}:`, error);
        // In case of error, restore the static description that was in the HTML
        const staticDescriptions = {
            'ai_insights': 'Provides detailed AI-generated insights about social media trends, sentiment analysis, and key discussion themes from your search results.',
            'data_story': 'Creates a narrative analysis connecting key insights, trends, and patterns from your query into a comprehensive data story.',
            'word_cloud': 'Visualizes the most frequently occurring terms in your query results with size indicating prominence.',
            'contributors': 'Identifies the most active users posting content matching your search criteria.',
            'timeseries': 'Tracks post volume over time to reveal when discussions peaked, declined, or remained steady.',
            'topic_evolution': 'Shows how conversation themes and topics change in prominence across different time periods.',
            'network': 'Maps connections between users based on their interactions, revealing community structure and influence patterns.',
            'topics': 'Identifies distinct topics within the content using Latent Dirichlet Allocation (LDA) to reveal key themes.',
            'semantic_map': 'Creates a 2D visualization where posts are positioned by semantic similarity, revealing content relationships.',
            'coordinated': 'Detects potentially coordinated posting behavior by identifying similar content posted within a short time window.',
            'coordinated_groups': 'Groups posts that share similar content and were created within the same time window.',
            'community_distribution': 'Shows the relative proportions of different communities or subreddits represented in your search results.'
        };
        
        // Fall back to the static description for this section
        if (staticDescriptions[sectionId]) {
            descriptionElement.innerHTML = `
                <i class="bi bi-info-circle"></i>
                <div class="description-content">
                    <h4 class="section-heading mb-3 text-primary">${sectionTitle}</h4>
                    <p class="mb-2">${staticDescriptions[sectionId]}</p>
                </div>
            `;
        }
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
    startDate = '';
    endDate = '';
    
    // Map of section IDs to user-friendly section titles
    const sectionTitles = {
        'ai_insights': 'Social Media Insights',
        'data_story': 'Comprehensive Data Story',
        'word_cloud': 'Word Cloud',
        'contributors': 'Top Contributors',
        'metrics': 'Key Metrics',
        'timeseries': 'Time Series Analysis',
        'topic_evolution': 'Topic Evolution',
        'network': 'User Network',
        'topics': 'Topic Analysis',
        'semantic_map': 'Semantic Map',
        'coordinated': 'Coordinated Behavior',
        'coordinated_groups': 'Coordinated Content Groups',
        'community_distribution': 'Community Distribution'
    };
    
    // Update all description areas to show loading state before starting analysis
    const descriptionAreas = [
        {id: 'ai-insights-description', section: 'ai_insights'},
        {id: 'data-story-description', section: 'data_story'},
        {id: 'word-cloud-description', section: 'word_cloud'},
        {id: 'contributors-description', section: 'contributors'},
        {id: 'metrics-description', section: 'metrics'},
        {id: 'timeseries-description', section: 'timeseries'},
        {id: 'topic-evolution-description', section: 'topic_evolution'},
        {id: 'network-description', section: 'network'},
        {id: 'topics-description', section: 'topics'},
        {id: 'semantic-map-description', section: 'semantic_map'},
        {id: 'coordinated-description', section: 'coordinated'},
        {id: 'coordinated-groups-description', section: 'coordinated_groups'},
        {id: 'community-distribution-description', section: 'community_distribution'}
    ];
    
    // Replace static descriptions with loading indicators using specific section titles
    descriptionAreas.forEach(item => {
        const element = document.getElementById(item.id);
        if (element) {
            const sectionTitle = sectionTitles[item.section] || item.section.replace(/_/g, ' ');
            element.innerHTML = `
                <i class="bi bi-info-circle"></i>
                <div class="description-content">
                    <div class="d-flex align-items-center">
                        <span class="spinner-border spinner-border-sm text-primary me-2" role="status"></span>
                        <h4 class="section-heading mb-0">Loading ${sectionTitle}...</h4>
                    </div>
                </div>
            `;
        }
    });
    
    // Update the semantic map container and topic clusters with loading indicators
    document.getElementById('semantic-map-container').innerHTML = `
        <div class="section-loading">
            <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
            Loading ${sectionTitles['semantic_map']}...
        </div>
    `;
    
    document.getElementById('topic-clusters').innerHTML = `
        <p class="text-muted"><span class="spinner-border spinner-border-sm text-primary" role="status"></span> Loading Topic Clusters...</p>
    `;
    
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
                document.getElementById('ai-summary').innerHTML = `
                    <div class="ai-summary-content">
                        <h3>Error Loading Data</h3>
                        <p class="text-danger">There was a problem loading the analysis data. Please try again or modify your query.</p>
                    </div>
                `;
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
            }),
        ];

        // Wait for critical components first
        await Promise.allSettled(criticalPromises);
        
        // Update dynamic descriptions for the overview sections first
        const overviewDescriptionPromises = [
            updateSectionDescription('ai_insights', '#ai-insights-description'),
            updateSectionDescription('data_story', '#data-story-description'),
            updateSectionDescription('word_cloud', '#word-cloud-description'),
            updateSectionDescription('contributors', '#contributors-description')
        ];
        
        // Process overview descriptions in the background
        Promise.allSettled(overviewDescriptionPromises);
        
        // Hide the main loading spinner as critical content is loaded
        showLoading(false);
        
        // Mark that analysis has been performed
        analysisPerformed = true;
        
        // PERFORMANCE OPTIMIZATION: Create placeholder loading indicators for remaining components
        document.getElementById('timeseries-chart').innerHTML = `<div class="section-loading"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading ${sectionTitles['timeseries']}...</div>`;
        document.getElementById('network-graph').innerHTML = `<div class="section-loading"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading ${sectionTitles['network']}...</div>`;
        document.getElementById('topics-container').innerHTML = `<div class="section-loading"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading ${sectionTitles['topics']}...</div>`;
        document.getElementById('coordinated-graph').innerHTML = `<div class="section-loading"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading ${sectionTitles['coordinated']}...</div>`;
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
                
                // Update timeseries description after data is loaded
                updateSectionDescription('timeseries', '#timeseries-description', {
                    dataPoints: document.querySelectorAll('#timeseries-chart circle.dot').length
                });
                
                // Phase 3: Now load the remaining heavier visualizations in the background
                // This allows the user to start interacting with the dashboard while heavy visualizations load
                setTimeout(async () => {
                    // Process remaining heavy visualizations in sequence to reduce load
                    try {
                        await updateTopics(query);
                        // Update topics description after data is loaded
                        updateSectionDescription('topics', '#topics-description', {
                            topicCount: document.getElementById('topics-count').value
                        });
                    } catch (error) {
                        console.error('Error updating topics:', error);
                        document.getElementById('topics-container').innerHTML = '<p class="text-danger">Error loading topics data</p>';
                    }
                    
                    try {
                        await updateNetwork(query);
                        // Update network description after data is loaded
                        updateSectionDescription('network', '#network-description', {
                            nodeCount: document.querySelectorAll('#network-graph circle').length
                        });
                    } catch (error) {
                        console.error('Error updating network:', error);
                        document.getElementById('network-graph').innerHTML = '<p class="text-danger">Error loading network data</p>';
                    }
                    
                    try {
                        await updateCoordinatedBehavior();
                        // Update coordinated behavior descriptions after data is loaded
                        updateSectionDescription('coordinated', '#coordinated-description', {
                            timeWindow: document.getElementById('time-window').value,
                            similarityThreshold: document.getElementById('similarity-threshold').value
                        });
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
    // Update topics description again after refresh
    updateSectionDescription('topics', '#topics-description', {
        topicCount: document.getElementById('topics-count').value
    });
    showLoading(false);
});

document.getElementById('update-coordinated-btn').addEventListener('click', async () => {
    showLoading(true);
    await updateCoordinatedBehavior();
    // Update coordinated description again after refresh
    updateSectionDescription('coordinated', '#coordinated-description', {
        timeWindow: document.getElementById('time-window').value,
        similarityThreshold: document.getElementById('similarity-threshold').value
    });
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
            
            // Display model used and enhanced summary - the summary already contains HTML markup
            document.getElementById('ai-summary').innerHTML = summaryData.summary;
            
            // Update metrics with enhanced data
            const metrics = summaryData.metrics;
            
            // Basic metrics
            document.getElementById('total-posts').textContent = metrics.total_posts || '-';
            document.getElementById('unique-authors').textContent = metrics.unique_authors || '-';
            document.getElementById('avg-comments').textContent = typeof metrics.avg_comments === 'number' ? 
                metrics.avg_comments.toFixed(1) : metrics.avg_comments;
            document.getElementById('time-span').textContent = metrics.days_span || '-';
            
            // Update metrics description with actual data from the query
            const metricsDescriptionEl = document.getElementById('metrics-description');
            if (metricsDescriptionEl) {
                try {
                    const keywordsList = metrics.top_keywords && metrics.top_keywords.length > 0 
                        ? metrics.top_keywords.slice(0, 3).join(', ') 
                        : '';
                    
                    // Create a specific description based on actual query results
                    let description = `Showing ${metrics.total_posts} posts from ${metrics.unique_authors} unique authors`;
                    if (keywordsList) {
                        description += ` with popular keywords: ${keywordsList}`;
                    }
                    if (metrics.days_span) {
                        description += `. Data spans ${metrics.days_span} days`;
                        
                        // Add post frequency insight
                        const postsPerDay = (metrics.total_posts / metrics.days_span).toFixed(1);
                        description += ` (approximately ${postsPerDay} posts per day)`;
                    }
                    if (typeof metrics.avg_comments === 'number') {
                        description += ` with an average of ${metrics.avg_comments.toFixed(1)} comments per post`;
                        
                        // Contextual assessment of engagement level
                        if (metrics.avg_comments > 30) {
                            description += ` - indicating exceptionally high engagement`;
                        } else if (metrics.avg_comments > 15) {
                            description += ` - showing strong community interest`;
                        } else if (metrics.avg_comments > 5) {
                            description += ` - reflecting moderate discussion activity`;
                        }
                    }
                    
                    // Add author concentration insights if data available
                    if (metrics.unique_authors && metrics.total_posts) {
                        const postsPerAuthor = (metrics.total_posts / metrics.unique_authors).toFixed(1);
                        description += `. On average, each author contributed ${postsPerAuthor} posts`;
                        
                        // Community type assessment
                        if (postsPerAuthor > 3) {
                            description += `, suggesting a core group of dedicated contributors`;
                        } else if (postsPerAuthor < 1.2) {
                            description += `, indicating a diverse community with broad participation`;
                        }
                    }
                    
                    // Add sentiment if available
                    if (metrics.sentiment_distribution) {
                        const sentiments = metrics.sentiment_distribution;
                        const topSentiment = Object.entries(sentiments).sort((a, b) => b[1] - a[1])[0];
                        if (topSentiment) {
                            description += `. Conversation tone appears predominantly ${topSentiment[0].toLowerCase()}`;
                        }
                    }
                    
                    description += '.';
                    
                    // Update the DOM with the HTML-formatted description
                    metricsDescriptionEl.innerHTML = `
                        <i class="bi bi-info-circle"></i>
                        <div class="description-content">
                            <h4 class="section-heading mb-3 text-primary">Key Metrics</h4>
                            <p class="mb-2">${description}</p>
                        </div>
                    `;
                } catch (err) {
                    console.error('Failed to update metrics description:', err);
                    // Keep the existing message if there's an error
                }
            }
            
            // Create extended metrics display
            let metricsContainer = document.getElementById('metrics-container');
            
            // Clear any existing extended metrics (beyond the 4 main metrics)
            // Preserve only the main metrics row with the basic stats
            const mainMetricsRow = metricsContainer.querySelector('.row.g-3');
            metricsContainer.innerHTML = '';
            
            // Re-add the main metrics row
            if (mainMetricsRow) {
                metricsContainer.appendChild(mainMetricsRow);
            } else {
                // Create a new main metrics row if it doesn't exist
                const newMainRow = document.createElement('div');
                newMainRow.className = 'row g-3';
                newMainRow.innerHTML = `
                    <div class="col-6">
                        <div class="stat-card">
                            <div class="stat-value" id="total-posts">${metrics.total_posts || '-'}</div>
                            <div class="stat-label">Total Posts</div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="stat-card">
                            <div class="stat-value" id="unique-authors">${metrics.unique_authors || '-'}</div>
                            <div class="stat-label">Unique Authors</div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="stat-card">
                            <div class="stat-value" id="avg-comments">${typeof metrics.avg_comments === 'number' ? 
                                metrics.avg_comments.toFixed(1) : metrics.avg_comments}</div>
                            <div class="stat-label">Avg. Comments</div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="stat-card">
                            <div class="stat-value" id="time-span">${metrics.days_span || '-'}</div>
                            <div class="stat-label">Days Span</div>
                        </div>
                    </div>
                `;
                metricsContainer.appendChild(newMainRow);
            }
            
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
    
    const response = await fetch(`/api/timeseries?${params.toString()}`);
    const data = await response.json();
    
    // If there's no data, show a message
    if (!data || data.length === 0) {
        document.getElementById('timeseries-chart').innerHTML = '<div class="alert alert-info">No time series data available for this query.</div>';
        return;
    }
    
    const timeseriesElement = document.getElementById('timeseries-chart');
    const containerWidth = timeseriesElement.clientWidth || timeseriesElement.offsetWidth || 800; // Fallback width
    const margin = {top: 20, right: 30, bottom: 50, left: 60};
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
    
    // Calculate moving average (7-day window)
    const movingAvgWindow = Math.min(7, data.length);
    const movingAvgData = [];
    
    for (let i = 0; i < data.length; i++) {
        let sum = 0;
        let count = 0;
        
        for (let j = Math.max(0, i - Math.floor(movingAvgWindow/2)); 
             j <= Math.min(data.length - 1, i + Math.floor(movingAvgWindow/2)); j++) {
            sum += data[j].count;
            count++;
        }
        
        movingAvgData.push({
            date: data[i].date,
            count: sum / count
        });
    }
    
    // Find peak points (local maxima) - points with higher values than neighbors
    const peaks = [];
    for (let i = 1; i < data.length - 1; i++) {
        if (data[i].count > data[i-1].count && 
            data[i].count > data[i+1].count && 
            data[i].count > d3.mean(data, d => d.count) * 1.5) { // At least 50% above average
            peaks.push(data[i]);
        }
    }
    // Limit to top 3 peaks
    peaks.sort((a, b) => b.count - a.count);
    const topPeaks = peaks.slice(0, 3);
    
    // Identify overall trend
    const firstHalf = data.slice(0, Math.floor(data.length/2));
    const secondHalf = data.slice(Math.floor(data.length/2));
    const firstHalfAvg = d3.mean(firstHalf, d => d.count);
    const secondHalfAvg = d3.mean(secondHalf, d => d.count);
    const trendPercent = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg * 100).toFixed(1);
    const trendDirection = secondHalfAvg > firstHalfAvg ? 'increasing' : 'decreasing';
    
    // Create scales
    const x = d3.scaleTime()
        .domain(d3.extent(data, d => d.date))
        .range([0, width]);
    
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count) * 1.1]) // Add space for annotations
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
    
    // Add the moving average line
    svg.append('path')
        .datum(movingAvgData)
        .attr('fill', 'none')
        .attr('stroke', '#dc3545')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5')
        .attr('d', d3.line()
            .x(d => x(d.date))
            .y(d => y(d.count))
        );
    
    // Add trend line
    if (data.length > 3) {
        // Simple linear regression for trend line
        const xValues = data.map((d, i) => i);
        const yValues = data.map(d => d.count);
        
        // Calculate linear regression (y = mx + b)
        const n = xValues.length;
        const sumX = xValues.reduce((a, b) => a + b, 0);
        const sumY = yValues.reduce((a, b) => a + b, 0);
        const sumXY = xValues.reduce((a, b, i) => a + b * yValues[i], 0);
        const sumXX = xValues.reduce((a, b) => a + b * b, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        // Create trend line
        const trendData = [
            { x: xValues[0], y: slope * xValues[0] + intercept },
            { x: xValues[xValues.length - 1], y: slope * xValues[xValues.length - 1] + intercept }
        ];
        
        // Draw trend line
        svg.append('line')
            .attr('x1', x(data[0].date))
            .attr('y1', y(trendData[0].y))
            .attr('x2', x(data[data.length - 1].date))
            .attr('y2', y(trendData[1].y))
            .attr('stroke', '#20c997')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '10,5')
            .attr('opacity', 0.7);
    }
    
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
    
    // Highlight peak points
    svg.selectAll('.peak')
        .data(topPeaks)
        .enter().append('circle')
        .attr('class', 'peak')
        .attr('cx', d => x(d.date))
        .attr('cy', d => y(d.count))
        .attr('r', 8)
        .attr('fill', '#dc3545')
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .append('title')
        .text(d => `Peak: ${d.date.toLocaleDateString()}\nPosts: ${d.count}`);
    
    // Add peak annotations
    topPeaks.forEach((peak, i) => {
        // Only add text annotations for the top peak to avoid clutter
        if (i === 0) {
            svg.append('text')
                .attr('x', x(peak.date))
                .attr('y', y(peak.count) - 15)
                .attr('text-anchor', 'middle')
                .style('font-size', '12px')
                .style('font-weight', 'bold')
                .text(`Peak: ${peak.count} posts`);
        }
    });
    
    // Add X axis
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(Math.min(data.length, 10)))
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-45)');
    
    // Add Y axis
    svg.append('g')
        .call(d3.axisLeft(y));
    
    // Add title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', -margin.top / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .style('font-weight', 'bold')
        .text(`Post Frequency for "${query}"`);
    
    // Add trend indicator
    const trendColor = trendDirection === 'increasing' ? '#20c997' : '#dc3545';
    svg.append('text')
        .attr('x', width - 10)
        .attr('y', 20)
        .attr('text-anchor', 'end')
        .style('font-size', '12px')
        .style('fill', trendColor)
        .text(`Trend: ${trendDirection} (${trendPercent}%)`);
    
    // Add legend
    const legend = svg.append('g')
        .attr('transform', `translate(${width - 180}, ${height + 30})`);
    
    // Data points
    legend.append('circle')
        .attr('cx', 10)
        .attr('cy', 0)
        .attr('r', 4)
        .attr('fill', '#0d6efd');
    
    legend.append('text')
        .attr('x', 20)
        .attr('y', 4)
        .style('font-size', '12px')
        .text('Daily posts');
    
    // Moving average
    legend.append('line')
        .attr('x1', 0)
        .attr('y1', 20)
        .attr('x2', 20)
        .attr('y2', 20)
        .attr('stroke', '#dc3545')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');
    
    legend.append('text')
        .attr('x', 25)
        .attr('y', 24)
        .style('font-size', '12px')
        .text('7-day average');
    
    // Trend line
    legend.append('line')
        .attr('x1', 0)
        .attr('y1', 40)
        .attr('x2', 20)
        .attr('y2', 40)
        .attr('stroke', '#20c997')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '10,5');
    
    legend.append('text')
        .attr('x', 25)
        .attr('y', 44)
        .style('font-size', '12px')
        .text('Trend line');
    
    // Add Y axis label
    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left)
        .attr('x', 0 - (height / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .text('Number of Posts');
    
    // Add X axis label
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', height + 40)
        .style('text-anchor', 'middle')
        .text('Date');
    
    // Force a redraw if needed (helps with rendering issues)
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    
    // Store time series data and peaks in global variable for later use
    window.timeSeriesData = {
        raw: data,
        peaks: topPeaks,
        trend: {
            direction: trendDirection,
            percent: trendPercent
        }
    };
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
    // Show loading state
    document.getElementById('network-graph').innerHTML = '<div class="section-loading"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading network analysis...</div>';
    
    // Get active network type from radio buttons
    const networkType = document.querySelector('input[name="network-type"]:checked')?.value || 'interaction';
    const contentType = document.querySelector('input[name="content-type"]:checked')?.value || 'all';
    const minSimilarity = document.getElementById('min-similarity-slider')?.value || 0.2;
    
    // Build URL with parameters
    let url = `/api/network?query=${encodeURIComponent(query)}`;
    url += `&network_type=${networkType}&content_type=${contentType}&min_similarity=${minSimilarity}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Network request failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check if we have valid data
    if (!data.nodes || data.nodes.length === 0) {
        document.getElementById('network-graph').innerHTML = '<div class="alert alert-info">No network data available for this query.</div>';
        return;
    }
    
    // Update network metrics display
    if (data.metrics) {
        document.getElementById('network-metrics').innerHTML = `
            <div class="row">
                <div class="col-md-3">
                    <div class="stat-card">
                        <div class="stat-value">${data.metrics.node_count}</div>
                        <div class="stat-label">Users</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card">
                        <div class="stat-value">${data.metrics.edge_count}</div>
                        <div class="stat-label">Connections</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card">
                        <div class="stat-value">${data.metrics.avg_degree.toFixed(2)}</div>
                        <div class="stat-label">Avg. Connections</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card">
                        <div class="stat-value">${(data.metrics.density * 100).toFixed(1)}%</div>
                        <div class="stat-label">Network Density</div>
                    </div>
                </div>
            </div>
        `;
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
    const networkTitle = networkType === 'interaction' 
        ? `User Interaction Network for "${query}"`
        : `Content Sharing Network for "${query}"`;
    
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .text(networkTitle);
    
    // PERFORMANCE OPTIMIZATION: Simplified forces and reduced iterations
    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links)
            .id(d => d.id)
            .distance(d => networkType === 'interaction' ? 75 : (100 / (d.similarity || 0.2)))) // Adjust distance based on similarity for content networks
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
            context.fillText(networkTitle, width/2, 20);
            
            // Draw links
            context.strokeStyle = '#999';
            context.lineWidth = 1;
            context.globalAlpha = 0.6;
            links.forEach(link => {
                // For content network, adjust line thickness based on similarity/shared content
                if (networkType !== 'interaction' && link.similarity) {
                    context.lineWidth = Math.max(1, Math.min(5, link.similarity * 5));
                    // Color links based on similarity
                    const hue = Math.min(120, Math.round(link.similarity * 120)); // 0-120 range (red to green)
                    context.strokeStyle = `hsl(${hue}, 70%, 50%)`;
                }
                
                context.beginPath();
                context.moveTo(link.source.x, link.source.y);
                context.lineTo(link.target.x, link.target.y);
                context.stroke();
                
                // Reset for next link
                context.lineWidth = 1;
                context.strokeStyle = '#999';
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
                
                // For content network, adjust node coloring
                if (networkType !== 'interaction') {
                    const nodeColor = color(node.group || 0);
                    context.fillStyle = nodeColor;
                } else {
                context.fillStyle = color(node.group || 0);
                }
                
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
        
        // Variables to track clicked node for showing details
        let selectedNode = null;
        
        // Add canvas interaction for node dragging and clicking
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
        
        // Add click handler to show node details
        d3.select(canvas).on('click', function() {
            const coords = d3.mouse(this);
            const x = coords[0];
            const y = coords[1];
            
            // Find the closest node
            let closest = null;
            let closestDistance = Infinity;
            
            nodes.forEach(node => {
                const dx = node.x - x;
                const dy = node.y - y;
                const distance = dx * dx + dy * dy;
                if (distance < closestDistance) {
                    closest = node;
                    closestDistance = distance;
                }
            });
            
            // Only select node if it's close enough (within radius)
            if (closestDistance < 200) {
                selectedNode = closest;
                showNodeDetails(selectedNode);
                
                // Highlight connected nodes by redrawing
                drawNetwork();
            } else {
                // Clear selection if clicking empty space
                selectedNode = null;
                hideNodeDetails();
            }
        });
        
    } else {
        // For smaller networks, use SVG as before
        // Create links with enhanced styling
        const link = svg.append('g')
            .selectAll('line')
            .data(links)
            .enter()
            .append('line')
            .attr('stroke', d => {
                // For content network, color links based on similarity
                if (networkType !== 'interaction' && d.similarity) {
                    const hue = Math.min(120, Math.round(d.similarity * 120)); // 0-120 range (red to green)
                    return `hsl(${hue}, 70%, 50%)`;
                }
                return '#999';
            })
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', d => {
                // For content network, adjust thickness based on similarity
                if (networkType !== 'interaction' && d.similarity) {
                    return Math.max(1, Math.min(5, d.similarity * 5));
                }
                return 1;
            })
            .on('mouseover', function(event, d) {
                // Show tooltip with shared content info for content networks
                if (networkType !== 'interaction' && d.shared_keywords) {
                    d3.select(this)
                        .attr('stroke-opacity', 1)
                        .attr('stroke-width', d => Math.max(2, Math.min(6, (d.similarity || 0.2) * 6)));
                    
                    const keywordsText = d.shared_keywords.length > 0 
                        ? `<strong>Shared Keywords:</strong> ${d.shared_keywords.join(', ')}<br>` 
                        : '';
                    
                    const hashtagsText = d.shared_hashtags.length > 0 
                        ? `<strong>Shared Hashtags:</strong> ${d.shared_hashtags.join(', ')}<br>` 
                        : '';
                    
                    const urlsText = d.shared_urls.length > 0 
                        ? `<strong>Shared URLs:</strong> ${d.shared_urls.slice(0, 2).join(', ')}${d.shared_urls.length > 2 ? '...' : ''}<br>` 
                        : '';
                    
                    const tooltipContent = `
                        <div class="network-tooltip">
                            <strong>${d.source.id} ↔ ${d.target.id}</strong><br>
                            <strong>Similarity:</strong> ${(d.similarity * 100).toFixed(1)}%<br>
                            ${keywordsText}
                            ${hashtagsText}
                            ${urlsText}
                            <strong>Total Shared Items:</strong> ${d.total_shared}
                        </div>
                    `;
                    
                    showTooltip(tooltipContent, event.pageX, event.pageY);
                }
            })
            .on('mouseout', function() {
                d3.select(this)
                    .attr('stroke-opacity', 0.6)
                    .attr('stroke-width', d => {
                        if (networkType !== 'interaction' && d.similarity) {
                            return Math.max(1, Math.min(5, d.similarity * 5));
                        }
                        return 1;
                    });
                
                hideTooltip();
            });
        
        // Create nodes with enhanced styling
        const node = svg.append('g')
            .selectAll('circle')
            .data(nodes)
            .enter()
            .append('circle')
            .attr('r', d => Math.min((d.size || 5), 12)) // Cap the radius
            .attr('fill', d => color(d.group || 0))
            .on('mouseover', function(event, d) {
                // Highlight node on hover
                d3.select(this)
                    .attr('stroke', '#000')
                    .attr('stroke-width', 2);
                
                // Show tooltip with node details
                let tooltipContent = `
                    <div class="network-tooltip">
                        <strong>${d.id}</strong><br>
                        <strong>Posts:</strong> ${d.posts}<br>
                `;
                
                // Add content metadata for content networks
                if (networkType !== 'interaction') {
                    const keywordsText = d.top_keywords && d.top_keywords.length > 0 
                        ? `<strong>Top Keywords:</strong> ${d.top_keywords.join(', ')}<br>` 
                        : '';
                    
                    const hashtagsText = d.top_hashtags && d.top_hashtags.length > 0 
                        ? `<strong>Top Hashtags:</strong> ${d.top_hashtags.join(', ')}<br>` 
                        : '';
                    
                    tooltipContent += `
                        ${keywordsText}
                        ${hashtagsText}
                        <strong>Keywords:</strong> ${d.keyword_count || 0}<br>
                        <strong>Hashtags:</strong> ${d.hashtag_count || 0}<br>
                        <strong>URLs:</strong> ${d.url_count || 0}
                    `;
                }
                
                tooltipContent += `</div>`;
                
                showTooltip(tooltipContent, event.pageX, event.pageY);
            })
            .on('mouseout', function() {
                d3.select(this)
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 1);
                hideTooltip();
            })
            .on('click', function(event, d) {
                showNodeDetails(d);
                
                // Highlight connected links and nodes
                link.attr('stroke-opacity', l => 
                    (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.2
                );
                
                node.attr('opacity', n => 
                    (n.id === d.id || links.some(l => 
                        (l.source.id === d.id && l.target.id === n.id) || 
                        (l.target.id === d.id && l.source.id === n.id)
                    )) ? 1 : 0.3
                );
            });
        
        // Add node labels for top nodes
        svg.append('g')
            .selectAll('text')
            .data(nodes.slice(0, 10)) // Only label top 10 nodes
            .enter()
            .append('text')
            .attr('x', d => d.x + 8)
            .attr('y', d => d.y + 3)
            .text(d => d.id)
            .attr('font-size', '8px')
            .attr('fill', '#333');
            
        // Add double-click handler to reset highlight
        svg.on('dblclick', function() {
            hideNodeDetails();
            link.attr('stroke-opacity', 0.6);
            node.attr('opacity', 1);
        });
        
        // Update positions on tick
        simulation.on('tick', () => {
            // Constrain nodes to view
            nodes.forEach(node => {
                node.x = Math.max(10, Math.min(width - 10, node.x));
                node.y = Math.max(10, Math.min(height - 10, node.y));
            });
            
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
            
            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);
            
            // Update label positions
            svg.selectAll('text')
                .attr('x', d => d.x + 8)
                .attr('y', d => d.y + 3);
        });
    }
    
    // Tooltip functions
    function showTooltip(html, x, y) {
        const tooltip = d3.select('body')
            .append('div')
            .attr('class', 'network-tooltip-container')
            .style('position', 'absolute')
            .style('background', 'white')
            .style('padding', '10px')
            .style('border-radius', '5px')
            .style('box-shadow', '0 0 10px rgba(0,0,0,0.2)')
            .style('pointer-events', 'none')
            .style('z-index', 1000)
            .style('max-width', '300px')
            .style('left', `${x + 10}px`)
            .style('top', `${y - 10}px`)
            .html(html);
    }
    
    function hideTooltip() {
        d3.select('.network-tooltip-container').remove();
    }
    
    // Node details panel functions
    function showNodeDetails(node) {
        // Select or create the details panel
        let detailsPanel = d3.select('#network-details-panel');
        
        if (detailsPanel.empty()) {
            detailsPanel = d3.select('#network-graph-container')
                .append('div')
                .attr('id', 'network-details-panel')
                .style('position', 'absolute')
                .style('right', '20px')
                .style('top', '70px')
                .style('width', '300px')
                .style('background', 'white')
                .style('border-radius', '8px')
                .style('box-shadow', '0 0 15px rgba(0,0,0,0.1)')
                .style('padding', '15px')
                .style('z-index', 10);
        }
        
        // Generate connected nodes info
        const connectedNodes = [];
        links.forEach(link => {
            if (link.source.id === node.id) {
                connectedNodes.push({
                    id: link.target.id,
                    connection: networkType === 'interaction' ? 'Comment interaction' : 'Content similarity',
                    details: link.shared_keywords || []
                });
            } else if (link.target.id === node.id) {
                connectedNodes.push({
                    id: link.source.id,
                    connection: networkType === 'interaction' ? 'Comment interaction' : 'Content similarity',
                    details: link.shared_keywords || []
                });
            }
        });
        
        // Create HTML content
        let htmlContent = `
            <div class="details-header">
                <h5>${node.id}</h5>
                <button id="close-details" class="btn-close" aria-label="Close"></button>
            </div>
            <div class="details-content">
                <p><strong>Posts:</strong> ${node.posts}</p>
        `;
        
        // Add content-specific details for content networks
        if (networkType !== 'interaction') {
            htmlContent += `
                <p><strong>Keywords:</strong> ${node.keyword_count || 0}</p>
                <p><strong>Hashtags:</strong> ${node.hashtag_count || 0}</p>
                <p><strong>URLs:</strong> ${node.url_count || 0}</p>
            `;
            
            // Add top keywords section
            if (node.top_keywords && node.top_keywords.length > 0) {
                htmlContent += `
                    <div class="mt-3">
                        <strong>Top Keywords:</strong>
                        <div class="keyword-tags">
                            ${node.top_keywords.map(kw => `<span class="badge bg-light text-dark">${kw}</span>`).join(' ')}
                        </div>
                    </div>
                `;
            }
            
            // Add top hashtags section
            if (node.top_hashtags && node.top_hashtags.length > 0) {
                htmlContent += `
                    <div class="mt-3">
                        <strong>Top Hashtags:</strong>
                        <div class="hashtag-tags">
                            ${node.top_hashtags.map(ht => `<span class="badge bg-info text-dark">${ht}</span>`).join(' ')}
                        </div>
                    </div>
                `;
            }
        }
        
        // Add connected nodes section
        if (connectedNodes.length > 0) {
            htmlContent += `
                <div class="mt-3">
                    <strong>Connected to ${connectedNodes.length} users:</strong>
                    <ul class="connected-list">
            `;
            
            // Sort connected nodes by most similar first for content networks
            if (networkType !== 'interaction') {
                connectedNodes.sort((a, b) => b.details.length - a.details.length);
            }
            
            // Show up to 10 connections
            connectedNodes.slice(0, 10).forEach(conn => {
                if (networkType === 'interaction') {
                    htmlContent += `<li>${conn.id}</li>`;
                } else {
                    // Find the link with similarity info
                    const connectionLink = links.find(l => 
                        (l.source.id === node.id && l.target.id === conn.id) || 
                        (l.target.id === node.id && l.source.id === conn.id)
                    );
                    
                    const similarityText = connectionLink && connectionLink.similarity 
                        ? `(${(connectionLink.similarity * 100).toFixed(1)}% similar)` 
                        : '';
                    
                    const keywordsText = connectionLink && connectionLink.shared_keywords && connectionLink.shared_keywords.length > 0
                        ? `<small>Keywords: ${connectionLink.shared_keywords.slice(0, 3).join(', ')}${connectionLink.shared_keywords.length > 3 ? '...' : ''}</small>`
                        : '';
                    
                    htmlContent += `
                        <li>
                            <strong>${conn.id}</strong> ${similarityText}
                            <div>${keywordsText}</div>
                        </li>
                    `;
                }
            });
            
            // Add indicator if there are more connections
            if (connectedNodes.length > 10) {
                htmlContent += `<li class="text-muted">...and ${connectedNodes.length - 10} more</li>`;
            }
            
            htmlContent += `
                    </ul>
                </div>
            `;
        }
        
        htmlContent += `</div>`;
        
        // Set the content
        detailsPanel.html(htmlContent);
        
        // Add event handler for close button
        detailsPanel.select('#close-details').on('click', hideNodeDetails);
    }
    
    function hideNodeDetails() {
        // Remove the details panel
        d3.select('#network-details-panel').remove();
        
        // Reset link and node styling
        if (d3.select('#network-graph svg').size() > 0) {
            const link = d3.selectAll('#network-graph line');
            const node = d3.selectAll('#network-graph circle');
            
            link.attr('stroke-opacity', 0.6);
            node.attr('opacity', 1);
        }
    }
    
    // Functions for node dragging
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

// Initialize the dashboard after document loads
document.addEventListener('DOMContentLoaded', function() {
    // Hide loading indicator initially
    showLoading(false);
    
    // Set up event listeners
    document.getElementById('analyze-btn').addEventListener('click', handleAnalyzeClick);
    
    // Set up network controls
    setupNetworkControls();
    
    // Set up topics range slider
    const topicsCountSlider = document.getElementById('topics-count');
    if (topicsCountSlider) {
        topicsCountSlider.addEventListener('input', function() {
            document.getElementById('topics-count-value').textContent = this.value;
        });
        
        document.getElementById('update-topics-btn').addEventListener('click', function() {
            const topicsCount = topicsCountSlider.value;
            const query = document.getElementById('query-input').value;
            updateTopics(query, topicsCount);
        });
    }
    
    // Tab change event listener - render charts if empty
    const analyticsTabs = document.getElementById('analyticsTabs');
    if (analyticsTabs) {
        analyticsTabs.addEventListener('shown.bs.tab', async function(event) {
            const targetId = event.target.getAttribute('data-bs-target');
            const activeQuery = document.getElementById('query-input').value;
            
            if (!activeQuery) return;
            
            // ... existing code ...
        });
    }
});

// Function to set up network controls
function setupNetworkControls() {
    // Network type radio buttons
    const networkTypeRadios = document.querySelectorAll('input[name="network-type"]');
    const contentOptions = document.getElementById('content-options');
    const similaritySliderContainer = document.getElementById('similarity-slider-container');
    const minSimilaritySlider = document.getElementById('min-similarity-slider');
    const similarityValueDisplay = document.getElementById('similarity-value');
    const updateNetworkBtn = document.getElementById('update-network-btn');
    
    // Initially hide content-specific controls when in interaction mode
    if (contentOptions && similaritySliderContainer) {
        // Check initial state
        const isContentNetwork = document.getElementById('content-network').checked;
        contentOptions.style.display = isContentNetwork ? 'block' : 'none';
        similaritySliderContainer.style.display = isContentNetwork ? 'block' : 'none';
    }
    
    // Add event listeners to network type radio buttons
    if (networkTypeRadios) {
        networkTypeRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                if (contentOptions && similaritySliderContainer) {
                    const isContentNetwork = this.value === 'content_sharing';
                    contentOptions.style.display = isContentNetwork ? 'block' : 'none';
                    similaritySliderContainer.style.display = isContentNetwork ? 'block' : 'none';
                }
            });
        });
    }
    
    // Add event listener to similarity slider
    if (minSimilaritySlider && similarityValueDisplay) {
        minSimilaritySlider.addEventListener('input', function() {
            const sliderValue = parseFloat(this.value) * 100;
            similarityValueDisplay.textContent = sliderValue.toFixed(0) + '%';
        });
    }
    
    // Add event listener to update network button
    if (updateNetworkBtn) {
        updateNetworkBtn.addEventListener('click', async function() {
            const query = document.getElementById('query-input').value;
            if (query) {
                try {
                    await updateNetwork(query);
                    // Update network description after data is loaded
                    updateSectionDescription('network', '#network-description', {
                        nodeCount: document.querySelectorAll('#network-graph circle').length
                    });
                } catch (error) {
                    console.error('Error updating network:', error);
                    document.getElementById('network-graph').innerHTML = '<p class="text-danger">Error loading network data</p>';
                }
            } else {
                alert('Please enter a search query first');
            }
        });
    }
}

// Topic Evolution Visualization
async function updateTopicEvolution(query) {
    try {
        // First, get topic data
        const topicsCount = document.getElementById('topics-count').value || 5;
        const response = await fetch(`/api/topics?n_topics=${topicsCount}&query=${encodeURIComponent(query)}`);
        
        if (!response.ok) {
            throw new Error(`Topics request failed with status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Check if we have valid data with topic evolution
        if (!data || !data.topic_evolution || Object.keys(data.topic_evolution).length === 0) {
            document.getElementById('topic-evolution-chart').innerHTML = 
                '<div class="alert alert-info">Not enough data available to show topic evolution for this query.</div>';
            return;
        }
        
        // Clear previous chart
        d3.select('#topic-evolution-chart').html('');
        
        const chartContainer = document.getElementById('topic-evolution-chart');
        const containerWidth = chartContainer.clientWidth || 800;
        const margin = {top: 30, right: 150, bottom: 50, left: 60}; // Extra right margin for labels
        const width = containerWidth - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;
        
        // Create SVG container
        const svg = d3.select('#topic-evolution-chart')
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);
        
        // Process data for visualization
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
        
        // Create a mapping of topic IDs to human-readable topic labels
        const topicLabels = {};
        topicIds.forEach(topicId => {
            const topicNumber = topicId.split('_')[1];
            const topic = data.topics.find(t => t.topic_id == topicNumber);
            if (topic && topic.top_words) {
                topicLabels[topicId] = `Topic ${topicNumber}: ${topic.top_words.slice(0, 3).join(', ')}`;
            } else {
                topicLabels[topicId] = `Topic ${topicNumber}`;
            }
        });
        
        // Create data points for each topic over time
        const chartData = [];
        topicIds.forEach((topicId, i) => {
            const topicData = {
                id: topicId,
                name: topicLabels[topicId],
                values: []
            };
            
            // Add values for all dates (filling in zeros for missing dates)
            sortedDates.forEach(date => {
                const dateObj = new Date(date);
                const value = data.topic_evolution[topicId][date] || 0;
                topicData.values.push({
                    date: dateObj,
                    value: value,
                    topicId: topicId
                });
            });
            
            chartData.push(topicData);
        });
        
        // Smooth the data (simple moving average)
        const smoothingWindow = Math.min(3, sortedDates.length);
        chartData.forEach(topic => {
            if (smoothingWindow > 1) {
                for (let i = 0; i < topic.values.length; i++) {
                    let sum = 0;
                    let count = 0;
                    
                    for (let j = Math.max(0, i - Math.floor(smoothingWindow/2)); 
                         j <= Math.min(topic.values.length - 1, i + Math.floor(smoothingWindow/2)); j++) {
                        sum += topic.values[j].value;
                        count++;
                    }
                    
                    topic.values[i].smoothedValue = sum / count;
                }
            } else {
                topic.values.forEach(v => v.smoothedValue = v.value);
            }
        });
        
        // Find topics with significant trends (increase or decrease)
        chartData.forEach(topic => {
            if (topic.values.length > 2) {
                const firstHalf = topic.values.slice(0, Math.floor(topic.values.length/2));
                const secondHalf = topic.values.slice(Math.floor(topic.values.length/2));
                
                const firstHalfAvg = d3.mean(firstHalf, d => d.value) || 0;
                const secondHalfAvg = d3.mean(secondHalf, d => d.value) || 0;
                
                // Calculate trend change percentage
                if (firstHalfAvg > 0) {
                    topic.trendChange = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg * 100).toFixed(1);
                } else {
                    topic.trendChange = secondHalfAvg > 0 ? "∞" : "0";
                }
                
                // Determine trend direction
                if (secondHalfAvg > firstHalfAvg * 1.2) {
                    topic.trend = 'rising';
                } else if (secondHalfAvg < firstHalfAvg * 0.8) {
                    topic.trend = 'falling';
                } else {
                    topic.trend = 'stable';
                }
            } else {
                topic.trend = 'unknown';
                topic.trendChange = 'N/A';
            }
        });
        
        // Sort topics by trend (rising first, then falling, then stable)
        chartData.sort((a, b) => {
            const trendOrder = { 'rising': 0, 'stable': 1, 'falling': 2, 'unknown': 3 };
            return trendOrder[a.trend] - trendOrder[b.trend];
        });
        
        // Setup scales
        const x = d3.scaleTime()
            .domain(d3.extent(sortedDates, d => new Date(d)))
            .range([0, width]);
        
        // Find max value across all topics and dates
        const maxValue = d3.max(chartData, d => d3.max(d.values, v => v.value)) * 1.1;
        
        const y = d3.scaleLinear()
            .domain([0, maxValue])
            .range([height, 0]);
        
        // Color scale for topics
        const color = d3.scaleOrdinal()
            .domain(topicIds)
            .range(d3.schemeCategory10);
        
        // Add axes
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat('%b %d')))
            .selectAll('text')
            .style('text-anchor', 'end')
            .attr('dx', '-.8em')
            .attr('dy', '.15em')
            .attr('transform', 'rotate(-45)');
        
        svg.append('g')
            .call(d3.axisLeft(y));
        
        // Add title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', -10)
            .attr('text-anchor', 'middle')
            .style('font-size', '16px')
            .style('font-weight', 'bold')
            .text(`Topic Evolution for "${query}"`);
        
        // Create area generator
        const area = d3.area()
            .x(d => x(d.date))
            .y0(height)
            .y1(d => y(d.smoothedValue))
            .curve(d3.curveMonotoneX);
        
        // Create line generator
        const line = d3.line()
            .x(d => x(d.date))
            .y(d => y(d.smoothedValue))
            .curve(d3.curveMonotoneX);
        
        // Add topic areas with reduced opacity
        chartData.forEach(topic => {
            svg.append('path')
                .datum(topic.values)
                .attr('fill', color(topic.id))
                .attr('fill-opacity', 0.1)
                .attr('d', area);
        });
        
        // Add topic lines
        chartData.forEach(topic => {
            svg.append('path')
                .datum(topic.values)
                .attr('fill', 'none')
                .attr('stroke', color(topic.id))
                .attr('stroke-width', 2)
                .attr('d', line);
            
            // Add circles at the last point of each line
            const lastPoint = topic.values[topic.values.length - 1];
            
            svg.append('circle')
                .attr('cx', x(lastPoint.date))
                .attr('cy', y(lastPoint.smoothedValue))
                .attr('r', 4)
                .attr('fill', color(topic.id))
                .attr('stroke', '#fff')
                .attr('stroke-width', 1);
        });
        
        // Add topic labels at the end of each line
        chartData.forEach((topic, i) => {
            const lastPoint = topic.values[topic.values.length - 1];
            
            // Stagger the labels vertically to avoid overlap
            const yOffset = i * 18 - (chartData.length * 9) + 10;
            
            svg.append('line')
                .attr('x1', x(lastPoint.date))
                .attr('y1', y(lastPoint.smoothedValue))
                .attr('x2', width + 15)
                .attr('y2', y(lastPoint.smoothedValue) + yOffset)
                .attr('stroke', color(topic.id))
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '3,3')
                .attr('opacity', 0.7);
            
            // Create a group for the label
            const labelGroup = svg.append('g')
                .attr('transform', `translate(${width + 20}, ${y(lastPoint.smoothedValue) + yOffset})`);
            
            // Add trend indicator symbol
            const trendSymbol = topic.trend === 'rising' ? '↑' : (topic.trend === 'falling' ? '↓' : '→');
            const trendColor = topic.trend === 'rising' ? '#20c997' : (topic.trend === 'falling' ? '#dc3545' : '#6c757d');
            
            labelGroup.append('text')
                .attr('x', 0)
                .attr('y', 0)
                .style('font-size', '14px')
                .style('font-weight', 'bold')
                .style('fill', trendColor)
                .text(trendSymbol);
            
            // Add topic label text
            const topWords = topic.name.split(':')[1] || '';
            labelGroup.append('text')
                .attr('x', 15)
                .attr('y', 0)
                .style('font-size', '11px')
                .style('font-weight', 'normal')
                .text(topWords);
            
            // Add trend percentage
            if (topic.trend !== 'unknown') {
                const trendText = topic.trend === 'rising' ? `+${topic.trendChange}%` : 
                                 (topic.trend === 'falling' ? `${topic.trendChange}%` : '');
                
                if (trendText) {
                    labelGroup.append('text')
                        .attr('x', 105)
                        .attr('y', 0)
                        .style('font-size', '10px')
                        .style('fill', trendColor)
                        .text(trendText);
                }
            }
        });
        
        // Add X axis label
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height + 40)
            .style('text-anchor', 'middle')
            .text('Date');
        
        // Add Y axis label
        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - margin.left)
            .attr('x', 0 - (height / 2))
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .text('Topic Prevalence');
        
        // Add interactive hover effects
        const focusLine = svg.append('line')
            .attr('class', 'focus-line')
            .attr('stroke', '#999')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '3,3')
            .attr('y1', 0)
            .attr('y2', height)
            .style('opacity', 0);
        
        const focusCircles = chartData.map(topic => {
            return svg.append('circle')
                .attr('class', 'focus-circle')
                .attr('r', 6)
                .attr('stroke', color(topic.id))
                .attr('stroke-width', 2)
                .attr('fill', '#fff')
                .style('opacity', 0);
        });
        
        const focusTextBg = svg.append('rect')
            .attr('class', 'focus-text-bg')
            .attr('fill', 'white')
            .attr('rx', 5)
            .attr('ry', 5)
            .attr('width', 180)
            .attr('height', chartData.length * 20 + 30)
            .style('opacity', 0);
        
        const focusText = svg.append('g')
            .attr('class', 'focus-text')
            .style('opacity', 0);
        
        // Add mouse tracking overlay
        const overlay = svg.append('rect')
            .attr('width', width)
            .attr('height', height)
            .style('fill', 'none')
            .style('pointer-events', 'all')
            .on('mouseover', function() {
                focusLine.style('opacity', 1);
                focusCircles.forEach(circle => circle.style('opacity', 1));
                focusTextBg.style('opacity', 0.9);
                focusText.style('opacity', 1);
            })
            .on('mouseout', function() {
                focusLine.style('opacity', 0);
                focusCircles.forEach(circle => circle.style('opacity', 0));
                focusTextBg.style('opacity', 0);
                focusText.style('opacity', 0);
            })
            .on('mousemove', mousemove);
        
        function mousemove(event) {
            const mouse = d3.pointer(event);
            const dateValue = x.invert(mouse[0]);
            
            // Find the closest date in our data
            let closestDate = sortedDates[0];
            let closestDistance = Math.abs(new Date(closestDate) - dateValue);
            
            for (let i = 1; i < sortedDates.length; i++) {
                const distance = Math.abs(new Date(sortedDates[i]) - dateValue);
                if (distance < closestDistance) {
                    closestDate = sortedDates[i];
                    closestDistance = distance;
                }
            }
            
            // Position the line at the closest date
            const xPos = x(new Date(closestDate));
            focusLine.attr('x1', xPos).attr('x2', xPos);
            
            // Set position for tooltip
            const tooltipX = xPos > width/2 ? xPos - 190 : xPos + 10;
            const tooltipY = 20;
            
            focusTextBg
                .attr('x', tooltipX)
                .attr('y', tooltipY);
            
            focusText.selectAll('*').remove();
            
            // Add date to tooltip
            focusText.append('text')
                .attr('x', tooltipX + 10)
                .attr('y', tooltipY + 20)
                .style('font-weight', 'bold')
                .text(new Date(closestDate).toLocaleDateString());
            
            // Update circle positions and add topic values to tooltip
            chartData.forEach((topic, i) => {
                const topicData = topic.values.find(v => v.date.getTime() === new Date(closestDate).getTime());
                
                if (topicData) {
                    // Position circle
                    focusCircles[i]
                        .attr('cx', xPos)
                        .attr('cy', y(topicData.smoothedValue));
                    
                    // Add topic data to tooltip
                    focusText.append('text')
                        .attr('x', tooltipX + 10)
                        .attr('y', tooltipY + 20 + ((i + 1) * 20))
                        .style('fill', color(topic.id))
                        .text(`${topic.name.split(':')[1]}: ${Math.round(topicData.value * 100) / 100}`);
                }
            });
        }
        
        // Update the topic evolution description after data is loaded
        updateSectionDescription('topic_evolution', '#topic-evolution-description', {
            topicCount: topicsCount,
            trendData: chartData.map(topic => ({
                name: topic.name,
                trend: topic.trend,
                change: topic.trendChange
            }))
        });
        
    } catch (error) {
        console.error('Error updating topic evolution:', error);
        document.getElementById('topic-evolution-chart').innerHTML = 
            `<div class="alert alert-danger">Error loading topic evolution data: ${error.message}</div>`;
    }
}

// Community Distribution Pie Chart
async function updateCommunityDistributionPieChart(query) {
    try {
        // We'll use the top contributors API and enhance it to include community data
        const response = await fetch(`/api/top_contributors?query=${encodeURIComponent(query)}&limit=20`);
        if (!response.ok) {
            throw new Error(`Request failed with status: ${response.status}`);
        }
        
        const contributorData = await response.json();
        
        // Also fetch AI summary data which contains subreddit distribution
        const summaryResponse = await fetch(`/api/ai_summary?query=${encodeURIComponent(query)}`);
        if (!summaryResponse.ok) {
            throw new Error(`Summary request failed with status: ${summaryResponse.status}`);
        }
        
        const summaryData = await summaryResponse.json();
        
        // Extract subreddit data from summary if available
        let subredditData = [];
        if (summaryData && summaryData.metrics && summaryData.metrics.top_subreddits) {
            subredditData = Object.entries(summaryData.metrics.top_subreddits).map(([name, count]) => ({
                name,
                count
            }));
        } else {
            // If no subreddit data in summary, create placeholder message
            document.getElementById('community-distribution').innerHTML = 
                '<div class="alert alert-info">No community distribution data available for this query.</div>';
            return;
        }
        
        // Add "Other" category if we have more than 7 subreddits to keep chart readable
        if (subredditData.length > 7) {
            const topSubreddits = subredditData.slice(0, 6);
            const otherSubreddits = subredditData.slice(6);
            const otherCount = otherSubreddits.reduce((sum, item) => sum + item.count, 0);
            
            subredditData = [
                ...topSubreddits,
                { name: 'Other Communities', count: otherCount }
            ];
        }
        
        // Sort by count
        subredditData.sort((a, b) => b.count - a.count);
        
        // Clear previous chart
        d3.select('#community-distribution').html('');
        
        const container = document.getElementById('community-distribution');
        const width = container.clientWidth || 600;
        const height = Math.min(500, width * 0.8);
        const radius = Math.min(width, height) / 2 - 30;
        
        // Create SVG
        const svg = d3.select('#community-distribution')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', `translate(${width / 2},${height / 2})`);
        
        // Set color scale
        const color = d3.scaleOrdinal()
            .domain(subredditData.map(d => d.name))
            .range(d3.schemeCategory10);
        
        // Compute the position of each group on the pie
        const pie = d3.pie()
            .value(d => d.count)
            .sort(null); // Keep the original order
        
        const pieData = pie(subredditData);
        
        // Shape helper to build arcs
        const arc = d3.arc()
            .innerRadius(radius * 0.4) // Create a donut chart
            .outerRadius(radius);
        
        // Another arc for labels
        const outerArc = d3.arc()
            .innerRadius(radius * 1.1)
            .outerRadius(radius * 1.1);
        
        // Build the pie chart
        const slices = svg.selectAll('path')
            .data(pieData)
            .enter()
            .append('path')
            .attr('d', arc)
            .attr('fill', d => color(d.data.name))
            .attr('stroke', 'white')
            .style('stroke-width', '2px')
            .style('opacity', 0.8)
            .on('mouseover', function(event, d) {
                d3.select(this)
                    .style('opacity', 1)
                    .style('stroke-width', '3px')
                    .transition()
                    .duration(200)
                    .attr('d', d3.arc()
                        .innerRadius(radius * 0.4)
                        .outerRadius(radius * 1.05));
                
                // Show percentage in center
                centerText.text(`${d.data.name}`);
                centerSubText.text(`${d.data.count} posts (${Math.round(d.data.count / totalPosts * 100)}%)`);
            })
            .on('mouseout', function() {
                d3.select(this)
                    .style('opacity', 0.8)
                    .style('stroke-width', '2px')
                    .transition()
                    .duration(200)
                    .attr('d', arc);
                
                // Reset center text
                centerText.text('Community');
                centerSubText.text('Distribution');
            });
        
        // Calculate total posts for percentage display
        const totalPosts = subredditData.reduce((sum, item) => sum + item.count, 0);
        
        // Add hoverable center text
        const centerText = svg.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '0em')
            .style('font-size', '1.3em')
            .style('font-weight', 'bold')
            .text('Community');
        
        const centerSubText = svg.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '1.5em')
            .style('font-size', '1em')
            .text('Distribution');
        
        // Add a title
        svg.append('text')
            .attr('x', 0)
            .attr('y', -height/2 + 20)
            .attr('text-anchor', 'middle')
            .style('font-size', '16px')
            .style('font-weight', 'bold')
            .text(`Community Distribution for "${query}"`);
        
        // Add labels with lines connecting to slices
        svg.selectAll('polyline')
            .data(pieData)
            .enter()
            .append('polyline')
            .attr('stroke', 'black')
            .style('fill', 'none')
            .attr('stroke-width', 1)
            .attr('points', function(d) {
                const pos = outerArc.centroid(d);
                pos[0] = radius * 0.95 * (midAngle(d) < Math.PI ? 1 : -1);
                return [arc.centroid(d), outerArc.centroid(d), pos];
            });
        
        svg.selectAll('text.label')
            .data(pieData)
            .enter()
            .append('text')
            .attr('class', 'label')
            .attr('dy', '.35em')
            .attr('transform', function(d) {
                const pos = outerArc.centroid(d);
                pos[0] = radius * (midAngle(d) < Math.PI ? 1.05 : -1.05);
                return `translate(${pos})`;
            })
            .style('text-anchor', d => midAngle(d) < Math.PI ? 'start' : 'end')
            .style('font-size', '12px')
            .text(d => {
                const percent = Math.round(d.data.count / totalPosts * 100);
                // Only show label if slice is big enough
                return percent > 3 ? `r/${d.data.name} (${percent}%)` : '';
            });
        
        // Helper function to compute the angle in the middle of an arc
        function midAngle(d) {
            return d.startAngle + (d.endAngle - d.startAngle) / 2;
        }
        
        // Add legend
        const legend = svg.selectAll('.legend')
            .data(pieData)
            .enter()
            .append('g')
            .attr('class', 'legend')
            .attr('transform', (d, i) => `translate(-${width/2 - 20}, ${i * 20 - height/2 + 50})`);
        
        legend.append('rect')
            .attr('width', 15)
            .attr('height', 15)
            .attr('fill', d => color(d.data.name));
        
        legend.append('text')
            .attr('x', 20)
            .attr('y', 12.5)
            .attr('font-size', '12px')
            .text(d => {
                const maxLength = 20;
                const name = d.data.name.length > maxLength ? 
                    d.data.name.substring(0, maxLength) + '...' : d.data.name;
                return `r/${name} (${d.data.count})`;
            });
        
        // Update the community distribution description
        updateSectionDescription('community_distribution', '#community-distribution-description', {
            communityCount: subredditData.length,
            topCommunities: subredditData.slice(0, 3).map(c => c.name),
            totalPosts: totalPosts
        });
        
    } catch (error) {
        console.error('Error updating community distribution:', error);
        document.getElementById('community-distribution').innerHTML = 
            `<div class="alert alert-danger">Error loading community distribution: ${error.message}</div>`;
    }
}

// Add updateTopicEvolution to the main analysis workflow
async function handleAnalyzeClick() {
    const query = document.getElementById('query-input').value;
    if (!query) {
        alert('Please enter a search query');
        return;
    }

    activeQuery = query;
    startDate = '';
    endDate = '';
    
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
        document.getElementById('topic-evolution-chart').innerHTML = '';
        document.getElementById('semantic-map-container').innerHTML = '';
        document.getElementById('point-details').innerHTML = '<p class="text-muted">Click on a point to see details</p>';
        document.getElementById('topic-clusters').innerHTML = '<p class="text-muted">Loading topic clusters...</p>';
        
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
                document.getElementById('ai-summary').innerHTML = `
                    <div class="ai-summary-content">
                        <h3>Error Loading Data</h3>
                        <p class="text-danger">There was a problem loading the analysis data. Please try again or modify your query.</p>
                    </div>
                `;
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
            }),
        ];

        // Wait for critical components first
        await Promise.allSettled(criticalPromises);
        
        // Update dynamic descriptions for the overview sections first
        const overviewDescriptionPromises = [
            updateSectionDescription('ai_insights', '#ai-insights-description'),
            updateSectionDescription('data_story', '#data-story-description'),
            updateSectionDescription('word_cloud', '#word-cloud-description'),
            updateSectionDescription('contributors', '#contributors-description')
        ];
        
        // Process overview descriptions in the background
        Promise.allSettled(overviewDescriptionPromises);
        
        // Hide the main loading spinner as critical content is loaded
        showLoading(false);
        
        // Mark that analysis has been performed
        analysisPerformed = true;
        
        // PERFORMANCE OPTIMIZATION: Create placeholder loading indicators for remaining components
        document.getElementById('timeseries-chart').innerHTML = '<div class="section-loading"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading time series analysis...</div>';
        document.getElementById('topic-evolution-chart').innerHTML = '<div class="section-loading"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading topic evolution analysis...</div>';
        document.getElementById('network-graph').innerHTML = '<div class="section-loading"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading network analysis...</div>';
        document.getElementById('topics-container').innerHTML = '<div class="section-loading"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading topic analysis...</div>';
        document.getElementById('coordinated-graph').innerHTML = '<div class="section-loading"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading coordinated behavior analysis...</div>';
        document.getElementById('coordinated-groups').innerHTML = '';
        document.getElementById('semantic-map-container').innerHTML = '<div class="section-loading"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading semantic map analysis...</div>';
        
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
                
                // Update topic evolution chart
                await updateTopicEvolution(query).catch(error => {
                    console.error('Error updating topic evolution:', error);
                    document.getElementById('topic-evolution-chart').innerHTML = '<p class="text-danger">Error loading topic evolution data</p>';
                });
                
                // Update semantic map
                await updateSemanticMap(query).catch(error => {
                    console.error('Error updating semantic map:', error);
                    document.getElementById('semantic-map-container').innerHTML = '<p class="text-danger">Error loading semantic map data</p>';
                });
                
                // Update timeseries description after data is loaded
                updateSectionDescription('timeseries', '#timeseries-description', {
                    dataPoints: document.querySelectorAll('#timeseries-chart circle.dot').length
                });
                
                // Phase 3: Now load the remaining heavier visualizations in the background
                // This allows the user to start interacting with the dashboard while heavy visualizations load
                setTimeout(async () => {
                    // Process remaining heavy visualizations in sequence to reduce load
                    try {
                        await updateTopics(query);
                        // Update topics description after data is loaded
                        updateSectionDescription('topics', '#topics-description', {
                            topicCount: document.getElementById('topics-count').value
                        });
                    } catch (error) {
                        console.error('Error updating topics:', error);
                        document.getElementById('topics-container').innerHTML = '<p class="text-danger">Error loading topics data</p>';
                    }
                    
                    try {
                        await updateNetwork(query);
                        // Update network description after data is loaded
                        updateSectionDescription('network', '#network-description', {
                            nodeCount: document.querySelectorAll('#network-graph circle').length
                        });
                    } catch (error) {
                        console.error('Error updating network:', error);
                        document.getElementById('network-graph').innerHTML = '<p class="text-danger">Error loading network data</p>';
                    }
                    
                    try {
                        await updateCoordinatedBehavior();
                        // Update coordinated behavior descriptions after data is loaded
                        updateSectionDescription('coordinated', '#coordinated-description', {
                            timeWindow: document.getElementById('time-window').value,
                            similarityThreshold: document.getElementById('similarity-threshold').value
                        });
                    } catch (error) {
                        console.error('Error updating coordinated behavior:', error);
                        document.getElementById('coordinated-graph').innerHTML = '<p class="text-danger">Error loading coordinated behavior data</p>';
                        document.getElementById('coordinated-groups').innerHTML = '<p class="text-danger">Error loading coordinated groups data</p>';
                    }
                    
                    // Update pie chart of contributors
                    try {
                        await updateCommunityDistributionPieChart(query);
                    } catch (error) {
                        console.error('Error updating community distribution:', error);
                        document.getElementById('community-distribution').innerHTML = '<p class="text-danger">Error loading community distribution data</p>';
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
}

// Function to update the semantic map
async function updateSemanticMap(query) {
    try {
        // Show loading indicator
        document.getElementById('semantic-map-container').innerHTML = `
            <div class="section-loading">
                <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                Loading semantic map...
            </div>
        `;
        document.getElementById('topic-clusters').innerHTML = `
            <div class="section-loading">
                <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                Loading topic clusters...
            </div>
        `;
        
        // Get parameters from UI controls
        const maxPoints = document.getElementById('max-points-slider').value;
        const nNeighbors = document.getElementById('n-neighbors-slider').value;
        const minDist = document.getElementById('min-dist-slider').value;
        
        // Build the URL with parameters
        let url = `/api/semantic_map?query=${encodeURIComponent(query)}&max_points=${maxPoints}&n_neighbors=${nNeighbors}&min_dist=${minDist}`;
        
        // Fetch semantic map data
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Check if we have valid data
        if (!data.points || data.points.length === 0) {
            document.getElementById('semantic-map-container').innerHTML = `
                <div class="alert alert-warning">
                    No data points available for the current query.
                </div>
            `;
            return;
        }
        
        // Update stats display
        document.getElementById('semantic-map-stats').innerHTML = `
            <strong>${data.total_posts}</strong> posts visualized | 
            <strong>${data.topics.length}</strong> topic clusters | 
            UMAP settings: neighbors=${data.umap_params.n_neighbors}, min_dist=${data.umap_params.min_dist}
        `;
        
        // Visualize the data
        renderSemanticMap(data);
        
        // Update the clusters sidebar
        updateTopicClusters(data.topics);
        
        // Update section description
        updateSectionDescription('semantic_map', '#semantic-map-description', {
            pointCount: data.total_posts,
            topicCount: data.topics.length,
            parameters: data.umap_params
        });
        
    } catch (error) {
        console.error('Error updating semantic map:', error);
        document.getElementById('semantic-map-container').innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle"></i> Error loading semantic map: ${error.message}
            </div>
        `;
    }
}

// Function to render the semantic map visualization
function renderSemanticMap(data) {
    // Clear previous visualization
    document.getElementById('semantic-map-container').innerHTML = '';
    
    // Set up dimensions
    const container = document.getElementById('semantic-map-container');
    const width = container.clientWidth;
    const height = container.clientHeight;
    const margin = {top: 10, right: 30, bottom: 30, left: 40};
    
    // Create SVG
    const svg = d3.select('#semantic-map-container').append('svg')
        .attr('width', width)
        .attr('height', height);
        
    // Create a group for zoom/pan transform
    const g = svg.append('g');
    
    // Add zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 8])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });
    
    svg.call(zoom);
    
    // Compute the data boundaries
    const xExtent = d3.extent(data.points, d => d.x);
    const yExtent = d3.extent(data.points, d => d.y);
    
    // Add some padding to the extents
    const xPadding = (xExtent[1] - xExtent[0]) * 0.05;
    const yPadding = (yExtent[1] - yExtent[0]) * 0.05;
    
    // Create scales
    const xScale = d3.scaleLinear()
        .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
        .range([margin.left, width - margin.right]);
        
    const yScale = d3.scaleLinear()
        .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
        .range([height - margin.bottom, margin.top]);
    
    // Create a color scale for clusters
    const showClusters = document.getElementById('show-clusters').checked;
    const clusterColorScale = d3.scaleOrdinal(d3.schemeCategory10)
        .domain(data.topics.map(t => t.id));
    
    // Create points
    g.selectAll('circle')
        .data(data.points)
        .enter()
        .append('circle')
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', 5)
        .attr('fill', d => showClusters ? clusterColorScale(d.cluster) : '#4a6fa5')
        .attr('opacity', 0.7)
        .attr('stroke', '#fff')
        .attr('stroke-width', 0.5)
        .attr('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            // Highlight point
            d3.select(this)
                .attr('r', 8)
                .attr('stroke-width', 1.5);
                
            // Show tooltip
            const tooltip = d3.select('#semantic-map-container')
                .append('div')
                .attr('class', 'semantic-tooltip')
                .style('position', 'absolute')
                .style('background', 'white')
                .style('border', '1px solid #ddd')
                .style('border-radius', '4px')
                .style('padding', '10px')
                .style('box-shadow', '0 2px 5px rgba(0,0,0,0.1)')
                .style('pointer-events', 'none')
                .style('left', `${event.pageX + 10}px`)
                .style('top', `${event.pageY + 10}px`)
                .style('z-index', 1000);
                
            tooltip.html(`
                <strong>${d.title}</strong><br>
                <span class="small text-muted">r/${d.subreddit} - ${d.author}</span><br>
                <span class="small">${new Date(d.created_utc).toLocaleDateString()}</span>
            `);
        })
        .on('mouseout', function() {
            // Reset point size
            d3.select(this)
                .attr('r', 5)
                .attr('stroke-width', 0.5);
                
            // Remove tooltip
            d3.select('.semantic-tooltip').remove();
        })
        .on('click', (event, d) => {
            showPointDetails(d);
        });
    
    // Show cluster topic labels if enabled
    if (document.getElementById('show-topic-labels').checked) {
        g.selectAll('text')
            .data(data.topics)
            .enter()
            .append('text')
            .attr('x', d => xScale(d.center_x))
            .attr('y', d => yScale(d.center_y))
            .attr('text-anchor', 'middle')
            .attr('font-size', d => Math.min(14, 10 + Math.sqrt(d.size/10)))
            .attr('font-weight', 'bold')
            .attr('pointer-events', 'none')
            .attr('fill', d => showClusters ? clusterColorScale(d.id) : '#333')
            .text(d => d.terms.slice(-3).join(' | '));
    }
    
    // Draw convex hulls around clusters if enabled
    if (document.getElementById('show-hulls').checked && showClusters) {
        // Group points by cluster
        const clusterGroups = {};
        data.points.forEach(p => {
            if (!clusterGroups[p.cluster]) {
                clusterGroups[p.cluster] = [];
            }
            clusterGroups[p.cluster].push([xScale(p.x), yScale(p.y)]);
        });
        
        // Draw hulls for each cluster
        Object.entries(clusterGroups).forEach(([clusterId, points]) => {
            if (points.length < 3) return; // Need at least 3 points for a hull
            
            try {
                // Compute hull points
                const hull = d3.polygonHull(points);
                
                if (!hull) return;
                
                // Create hull path
                const hullPath = 'M' + hull.join('L') + 'Z';
                
                // Add hull to the visualization
                g.append('path')
                    .attr('d', hullPath)
                    .attr('fill', clusterColorScale(clusterId))
                    .attr('stroke', clusterColorScale(clusterId))
                    .attr('stroke-width', 1)
                    .attr('fill-opacity', 0.1)
                    .attr('stroke-opacity', 0.3);
            } catch (e) {
                console.warn('Could not create hull for cluster', clusterId, e);
            }
        });
    }
    
    // Add initial zoom to fit all points
    svg.call(zoom.transform, d3.zoomIdentity
        .translate(width/2, height/2)
        .scale(0.85)
        .translate(-width/2, -height/2));
}

// Function to update the topic clusters sidebar
function updateTopicClusters(topics) {
    // Clear existing content
    const clusterContainer = document.getElementById('topic-clusters');
    clusterContainer.innerHTML = '';
    
    if (!topics || topics.length === 0) {
        clusterContainer.innerHTML = `<p class="text-muted">No topic clusters identified.</p>`;
        return;
    }
    
    // Sort topics by size (descending)
    const sortedTopics = [...topics].sort((a, b) => b.size - a.size);
    
    // Create a list of topic clusters
    const topicList = document.createElement('div');
    topicList.className = 'list-group';
    
    sortedTopics.forEach(topic => {
        const topicItem = document.createElement('div');
        topicItem.className = 'list-group-item list-group-item-action';
        
        const badge = `<span class="badge bg-primary float-end">${topic.size}</span>`;
        const terms = topic.terms.join(', ');
        
        topicItem.innerHTML = `
            <div class="d-flex w-100 justify-content-between">
                <h6 class="mb-1">Cluster ${topic.id + 1}</h6>
                ${badge}
            </div>
            <p class="mb-1 small">${terms}</p>
        `;
        
        topicList.appendChild(topicItem);
    });
    
    clusterContainer.appendChild(topicList);
}

// Function to show detailed information about a clicked point
function showPointDetails(point) {
    const detailsContainer = document.getElementById('point-details');
    
    const date = new Date(point.created_utc).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    
    detailsContainer.innerHTML = `
        <h6>${point.title}</h6>
        <div class="mb-2">
            <span class="badge bg-secondary">r/${point.subreddit}</span>
            <span class="badge bg-light text-dark">u/${point.author}</span>
            <span class="badge bg-light text-dark">${date}</span>
        </div>
        <p class="small">${point.preview_text}</p>
        <div class="d-flex">
            <div class="me-3">
                <i class="bi bi-chat-dots"></i> ${point.num_comments} comments
            </div>
            <div>
                <i class="bi bi-arrow-up-circle"></i> ${point.score} score
            </div>
        </div>
    `;
}

// Set up event handlers for semantic map controls
document.addEventListener('DOMContentLoaded', function() {
    // Set up analyze button click handler
    document.getElementById('analyze-btn').addEventListener('click', handleAnalyzeClick);
    
    // Set up semantic map update button handler
    const updateBtn = document.getElementById('update-semantic-map-btn');
    if (updateBtn) {
        updateBtn.addEventListener('click', function() {
            if (!activeQuery) {
                alert('Please run a query first');
                return;
            }
            updateSemanticMap(activeQuery);
        });
    }
    
    // Update parameter value displays
    const maxPointsSlider = document.getElementById('max-points-slider');
    const nNeighborsSlider = document.getElementById('n-neighbors-slider');
    const minDistSlider = document.getElementById('min-dist-slider');
    
    if (maxPointsSlider) {
        maxPointsSlider.addEventListener('input', function() {
            document.getElementById('max-points-value').textContent = this.value;
        });
    }
    
    if (nNeighborsSlider) {
        nNeighborsSlider.addEventListener('input', function() {
            document.getElementById('n-neighbors-value').textContent = this.value;
        });
    }
    
    if (minDistSlider) {
        minDistSlider.addEventListener('input', function() {
            document.getElementById('min-dist-value').textContent = this.value;
        });
    }
    
    // Real-time display toggles
    const displayOptions = ['show-topic-labels', 'show-clusters', 'show-hulls'];
    displayOptions.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', function() {
                // Only update if we have already performed analysis
                if (analysisPerformed && activeQuery) {
                    updateSemanticMap(activeQuery);
                }
            });
        }
    });
    
    // Set up chatbot interactions
    setupChatbotInteractions();
});

// Chatbot functionality
let chatHistory = [];

function setupChatbotInteractions() {
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-chat-btn');
    
    // Send message on button click
    if (sendButton) {
        sendButton.addEventListener('click', function() {
            sendChatMessage();
        });
    }
    
    // Send message on Enter key
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
    }
}

function sendChatMessage() {
    const chatInput = document.getElementById('chat-input');
    const userQuery = chatInput.value.trim();
    
    if (!userQuery) return; // Don't send empty messages
    
    // Clear input field
    chatInput.value = '';
    
    // Add user message to chat
    addMessageToChat('user', userQuery);
    
    // Show typing indicator
    showTypingIndicator();
    
    // Add message to history
    chatHistory.push({ role: 'user', content: userQuery });
    
    // Send message to API
    processChatMessage(userQuery);
}

function addMessageToChat(role, content, time = null) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    
    // Set class based on message role
    messageDiv.className = role === 'user' ? 'user-message' : 
                          (role === 'system' ? 'system-message' : 'assistant-message');
    
    // Create message content
    const contentP = document.createElement('div');
    contentP.className = 'message-content';
    contentP.innerHTML = content;
    messageDiv.appendChild(contentP);
    
    // Add timestamp if provided
    if (time) {
        const timeSpan = document.createElement('div');
        timeSpan.className = 'message-time';
        timeSpan.textContent = time;
        messageDiv.appendChild(timeSpan);
    }
    
    // Add message to chat
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
    const chatMessages = document.getElementById('chat-messages');
    const indicatorDiv = document.createElement('div');
    indicatorDiv.className = 'typing-indicator';
    indicatorDiv.id = 'typing-indicator';
    
    // Add three dots
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.className = 'dot';
        indicatorDiv.appendChild(dot);
    }
    
    chatMessages.appendChild(indicatorDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

function processChatMessage(query) {
    // Hide previous suggestions and metrics
    document.getElementById('viz-suggestions').style.display = 'none';
    document.getElementById('related-metrics').style.display = 'none';
    
    // Call API to process the message
    fetch('/api/chatbot', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            query: query,
            history: chatHistory.slice(-5) // Send last 5 messages for context
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Hide typing indicator
        hideTypingIndicator();
        
        // Add AI response to chat
        addMessageToChat('assistant', data.response);
        
        // Add to chat history
        chatHistory.push({ role: 'assistant', content: data.response });
        
        // Display visualization suggestions if any
        if (data.visualization_suggestions && data.visualization_suggestions.length > 0) {
            displayVisualizationSuggestions(data.visualization_suggestions);
        }
        
        // Display metrics if any
        if (data.metrics) {
            displayRelatedMetrics(data.metrics);
        }
    })
    .catch(error => {
        // Hide typing indicator
        hideTypingIndicator();
        
        // Add error message
        addMessageToChat('assistant', `I'm sorry, I couldn't process your request: ${error.message}`);
        
        console.error('Error processing chat message:', error);
    });
}

function displayVisualizationSuggestions(suggestions) {
    const container = document.getElementById('viz-suggestions-content');
    container.innerHTML = '';
    
    suggestions.forEach(suggestion => {
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4';
        
        const card = document.createElement('div');
        card.className = 'card suggestion-card h-100';
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
            // Switch to relevant tab based on suggestion type
            switch(suggestion.type) {
                case 'time_series':
                    document.getElementById('timeseries-tab').click();
                    break;
                case 'topics':
                    document.getElementById('topics-tab').click();
                    break;
                case 'network':
                    document.getElementById('network-tab').click();
                    break;
                case 'semantic_map':
                    document.getElementById('semantic-map-tab').click();
                    break;
                case 'community_distribution':
                    document.getElementById('network-tab').click(); // This is on the network tab
                    break;
                case 'coordinated':
                    document.getElementById('coordinated-tab').click();
                    break;
                default:
                    document.getElementById('overview-tab').click();
                    break;
            }
        });
        
        // Get appropriate icon for visualization type
        let icon = 'graph-up';
        switch(suggestion.type) {
            case 'time_series': icon = 'graph-up'; break;
            case 'topics': icon = 'chat-square-text'; break;
            case 'network': icon = 'diagram-3'; break;
            case 'semantic_map': icon = 'map'; break;
            case 'community_distribution': icon = 'pie-chart'; break;
            case 'coordinated': icon = 'people'; break;
            case 'overview': icon = 'list-ul'; break;
        }
        
        card.innerHTML = `
            <div class="card-body">
                <h5 class="card-title"><i class="bi bi-${icon}"></i> ${suggestion.title}</h5>
                <p class="card-text small">${suggestion.description}</p>
            </div>
            <div class="card-footer bg-transparent text-end">
                <small class="text-muted">Click to view</small>
            </div>
        `;
        
        col.appendChild(card);
        container.appendChild(col);
    });
    
    // Show the container
    document.getElementById('viz-suggestions').style.display = 'block';
}

function displayRelatedMetrics(metrics) {
    const container = document.getElementById('metrics-content');
    container.innerHTML = '';
    
    // Define the metrics to show and their formats
    const metricsToShow = [
        { key: 'total_posts', label: 'Total Posts', format: value => value.toLocaleString() },
        { key: 'unique_authors', label: 'Unique Authors', format: value => value.toLocaleString() },
        { key: 'avg_comments', label: 'Avg. Comments', format: value => value.toFixed(1) }
    ];
    
    // Add time range if available
    if (metrics.time_range) {
        const startDate = new Date(metrics.time_range.start).toLocaleDateString();
        const endDate = new Date(metrics.time_range.end).toLocaleDateString();
        
        const col = document.createElement('div');
        col.className = 'col-12';
        col.innerHTML = `
            <div class="alert alert-light">
                <small class="fw-medium">Data Range: ${startDate} to ${endDate}</small>
            </div>
        `;
        container.appendChild(col);
    }
    
    // Add standard metrics
    metricsToShow.forEach(metricDef => {
        if (metrics[metricDef.key] !== undefined) {
            const col = document.createElement('div');
            col.className = 'col-md-4';
            
            col.innerHTML = `
                <div class="stat-card">
                    <div class="stat-value">${metricDef.format(metrics[metricDef.key])}</div>
                    <div class="stat-label">${metricDef.label}</div>
                </div>
            `;
            
            container.appendChild(col);
        }
    });
    
    // Add peak date if available (for trend analysis)
    if (metrics.peak_date) {
        const col = document.createElement('div');
        col.className = 'col-md-4';
        
        col.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${metrics.peak_date}</div>
                <div class="stat-label">Peak Activity</div>
            </div>
        `;
        
        container.appendChild(col);
    }
    
    // Add trend direction if available
    if (metrics.trend && metrics.trend.direction) {
        const col = document.createElement('div');
        col.className = 'col-md-4';
        
        const icon = metrics.trend.direction === 'increasing' ? 
            '<i class="bi bi-arrow-up-right text-success"></i>' : 
            '<i class="bi bi-arrow-down-right text-danger"></i>';
        
        col.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${icon} ${metrics.trend.direction.charAt(0).toUpperCase() + metrics.trend.direction.slice(1)}</div>
                <div class="stat-label">Overall Trend</div>
            </div>
        `;
        
        container.appendChild(col);
    }
    
    // Show top subreddits if available
    if (metrics.top_subreddits) {
        const col = document.createElement('div');
        col.className = 'col-12 mt-3';
        
        const subreddits = Object.entries(metrics.top_subreddits)
            .slice(0, 3)
            .map(([name, count]) => `<span class="badge bg-light text-dark">r/${name} (${count})</span>`)
            .join(' ');
        
        col.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h6 class="card-title">Top Subreddits</h6>
                    <div>${subreddits}</div>
                </div>
            </div>
        `;
        
        container.appendChild(col);
    }
    
    // Show top keywords if available
    if (metrics.top_keywords && metrics.top_keywords.length > 0) {
        const col = document.createElement('div');
        col.className = 'col-12 mt-3';
        
        const keywords = metrics.top_keywords
            .slice(0, 5)
            .map(word => `<span class="badge bg-light text-dark">${word}</span>`)
            .join(' ');
        
        col.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h6 class="card-title">Key Terms</h6>
                    <div>${keywords}</div>
                </div>
            </div>
        `;
        
        container.appendChild(col);
    }
    
    // Show the container
    document.getElementById('related-metrics').style.display = 'block';
}

// ... existing code ...