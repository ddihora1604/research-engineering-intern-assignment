// Global state
let activeQuery = '';
let startDate = '';
let endDate = '';

// File upload handling
document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select a file');
        return;
    }
    
    showLoading(true);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (response.ok) {
            alert(`File uploaded successfully: ${data.rows} rows loaded`);
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        alert('Error uploading file');
        console.error(error);
    } finally {
        showLoading(false);
    }
});

// Analysis button click handler
document.getElementById('analyze-btn').addEventListener('click', async () => {
    const query = document.getElementById('query-input').value;
    activeQuery = query;
    startDate = document.getElementById('start-date').value;
    endDate = document.getElementById('end-date').value;
    
    if (!query) {
        alert('Please enter a search query');
        return;
    }
    
    showLoading(true);
    
    try {
        // Update all visualizations
        await Promise.all([
            updateOverview(query),
            updateTimeSeries(query),
            updateContributors(query),
            updateNetwork(query),
            updateTopics(query),
            updateCoordinatedBehavior(),
            updateWordCloud(query)
        ]);
    } catch (error) {
        alert('Error performing analysis');
        console.error(error);
    } finally {
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

// Button handlers for updating specific visualizations
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

// Helper to show/hide loading spinner
function showLoading(show) {
    const loadingElement = document.getElementById('loading');
    if (show) {
        loadingElement.style.display = 'block';
    } else {
        loadingElement.style.display = 'none';
    }
}

// Overview Section - AI Summary and Metrics
async function updateOverview(query) {
    try {
        // Update AI summary
        const summaryResponse = await fetch(`/api/ai_summary?query=${encodeURIComponent(query)}`);
        if (summaryResponse.ok) {
            const summaryData = await summaryResponse.json();
            document.getElementById('ai-summary').innerHTML = `
                <h4>Analysis of "${query}"</h4>
                <p>${summaryData.summary}</p>
            `;
            
            // Update metrics
            const metrics = summaryData.metrics;
            document.getElementById('total-posts').textContent = metrics.total_posts;
            document.getElementById('unique-authors').textContent = metrics.unique_authors;
            document.getElementById('avg-comments').textContent = typeof metrics.avg_comments === 'number' ? 
                metrics.avg_comments.toFixed(1) : metrics.avg_comments;
            
            // Calculate time span in days
            if (metrics.time_range) {
                const dates = metrics.time_range.split(' to ');
                if (dates.length === 2) {
                    const date1 = new Date(dates[0]);
                    const date2 = new Date(dates[1]);
                    const diffTime = Math.abs(date2 - date1);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    document.getElementById('time-span').textContent = diffDays;
                }
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
    const response = await fetch(`/api/common_words?query=${encodeURIComponent(query)}&limit=100`);
    const words = await response.json();
    
    // Clear previous word cloud
    d3.select('#word-cloud').html('');
    
    const width = document.getElementById('word-cloud').clientWidth;
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
            .text(d => `${d.text}: ${d.value}`);
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
    
    const containerWidth = document.getElementById('timeseries-chart').clientWidth;
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

// Network Visualization
async function updateNetwork(query) {
    const response = await fetch(`/api/network?query=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    // Clear previous chart
    d3.select('#network-graph').html('');
    
    const width = document.getElementById('network-graph').clientWidth;
    const height = 600;
    
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
    
    // Define simulation with forces
    const simulation = d3.forceSimulation(data.nodes)
        .force('link', d3.forceLink(data.links)
            .id(d => d.id)
            .distance(100)
            .strength(link => Math.min(0.5, link.weight ? link.weight * 0.1 : 0.1)))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(d => (d.size || 10) + 5));
    
    // Create legend for communities
    const uniqueGroups = [...new Set(data.nodes.map(d => d.group))];
    
    const legend = svg.append('g')
        .attr('transform', `translate(${width - 150}, 50)`);
    
    legend.selectAll('.legend-item')
        .data(uniqueGroups)
        .enter()
        .append('g')
        .attr('class', 'legend-item')
        .attr('transform', (d, i) => `translate(0, ${i * 20})`)
        .each(function(d) {
            d3.select(this)
                .append('rect')
                .attr('width', 10)
                .attr('height', 10)
                .attr('fill', color(d));
            
            d3.select(this)
                .append('text')
                .attr('x', 15)
                .attr('y', 10)
                .text(`Group ${d}`)
                .style('font-size', '12px');
        });
    
    // Create links
    const link = svg.append('g')
        .selectAll('line')
        .data(data.links)
        .enter()
        .append('line')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', d => d.weight ? Math.sqrt(d.weight) : 1);
    
    // Create nodes
    const node = svg.append('g')
        .selectAll('circle')
        .data(data.nodes)
        .enter()
        .append('circle')
        .attr('r', d => d.size || 10)
        .attr('fill', d => color(d.group || 0))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));
    
    // Add tooltips
    node.append('title')
        .text(d => `${d.id} (${d.posts || 0} posts)`);
    
    // Add node labels for nodes with more posts
    svg.append('g')
        .selectAll('text')
        .data(data.nodes.filter(d => d.posts > 3))  // Only label significant nodes
        .enter()
        .append('text')
        .attr('dx', d => d.size + 5)
        .attr('dy', '.35em')
        .text(d => d.id)
        .style('font-size', '10px')
        .style('font-family', 'Arial')
        .style('pointer-events', 'none');  // Make text not interfere with mouse events
    
    // Update positions on each tick
    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        
        node
            .attr('cx', d => d.x = Math.max(d.size || 10, Math.min(width - (d.size || 10), d.x)))
            .attr('cy', d => d.y = Math.max(d.size || 10, Math.min(height - (d.size || 10), d.y)));
        
        // Update label positions
        svg.selectAll('text')
            .attr('x', d => d ? d.x : 0)
            .attr('y', d => d ? d.y : 0);
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
}

// Topic Analysis Visualization
async function updateTopics(query) {
    const topicsCount = document.getElementById('topics-count').value;
    const response = await fetch(`/api/topics?n_topics=${topicsCount}&query=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    // Clear previous visualization
    d3.select('#topics-container').html('');
    
    const container = d3.select('#topics-container');
    
    // Color scale for topics
    const color = d3.scaleOrdinal(d3.schemeCategory10);
    
    // Create a div for each topic
    data.forEach((topic, i) => {
        const topicContainer = container.append('div')
            .attr('class', 'card mb-3')
            .style('border-left', `4px solid ${color(i)}`);
        
        topicContainer.append('div')
            .attr('class', 'card-header')
            .html(`<strong>Topic ${i+1}</strong>`);
        
        const cardBody = topicContainer.append('div')
            .attr('class', 'card-body');
        
        // Create word cloud for this topic
        const cloudContainer = cardBody.append('div')
            .attr('id', `topic-cloud-${i}`)
            .style('height', '150px')
            .style('width', '100%');
        
        // Scale for word size within this topic
        const maxSize = 24;  // Max font size
        
        // Create a simple horizontal bar for each word
        const words = topic.top_words;
        const wordsDiv = cardBody.append('div')
            .attr('class', 'mt-3');
        
        words.forEach((word, j) => {
            wordsDiv.append('span')
                .style('font-size', `${Math.max(14, maxSize - j*2)}px`)
                .style('color', color(i))
                .style('margin-right', '10px')
                .text(word);
        });
    });
}

// Coordinated Behavior Analysis
async function updateCoordinatedBehavior() {
    const timeWindow = document.getElementById('time-window').value;
    const similarityThreshold = document.getElementById('similarity-threshold').value;
    
    const response = await fetch(`/api/coordinated?time_window=${timeWindow}&similarity_threshold=${similarityThreshold}`);
    const data = await response.json();
    
    // Update stats
    document.getElementById('total-groups').textContent = data.total_groups;
    document.getElementById('total-authors').textContent = data.total_authors;
    
    // Clear previous visualizations
    d3.select('#coordinated-graph').html('');
    d3.select('#coordinated-groups').html('');
    
    // 1. Render the network graph
    const width = document.getElementById('coordinated-graph').clientWidth;
    const height = 400;
    
    const svg = d3.select('#coordinated-graph')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    // Define color scale for the network
    const color = d3.scaleOrdinal(d3.schemeCategory10);
    
    // Create simulation
    const simulation = d3.forceSimulation(data.network.nodes)
        .force('link', d3.forceLink(data.network.links).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2));
    
    // Draw links
    const link = svg.append('g')
        .selectAll('line')
        .data(data.network.links)
        .enter()
        .append('line')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', 1.5);
    
    // Draw nodes
    const node = svg.append('g')
        .selectAll('circle')
        .data(data.network.nodes)
        .enter()
        .append('circle')
        .attr('r', 8)
        .attr('fill', (d, i) => color(i % 10))
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));
    
    // Add tooltips to nodes
    node.append('title')
        .text(d => d.id);
    
    // Add labels to nodes
    const labels = svg.append('g')
        .selectAll('text')
        .data(data.network.nodes)
        .enter()
        .append('text')
        .attr('dx', 12)
        .attr('dy', '.35em')
        .text(d => d.id)
        .style('font-size', '10px')
        .style('pointer-events', 'none');
    
    // Update positions on simulation tick
    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        
        node
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
        
        labels
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
    
    // 2. Render the coordinated groups
    const groupsContainer = d3.select('#coordinated-groups');
    
    data.groups.forEach((group, i) => {
        const groupDiv = groupsContainer.append('div')
            .attr('class', 'coordinated-group')
            .style('border-left-color', color(i % 10));
        
        groupDiv.append('h5')
            .text(`Group ${i+1} (${group.length} posts)`);
        
        const postsList = groupDiv.append('ul')
            .attr('class', 'list-group');
        
        group.forEach(post => {
            postsList.append('li')
                .attr('class', 'list-group-item')
                .html(`
                    <div>
                        <strong>${post.author}</strong> - 
                        ${new Date(post.created_utc).toLocaleString()}
                    </div>
                    <div>${post.title}</div>
                    <div><a href="${post.url}" target="_blank">View post</a></div>
                `);
        });
    });
} 