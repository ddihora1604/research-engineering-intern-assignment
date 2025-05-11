// File upload handling
document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select a file');
        return;
    }
    
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
    }
});

// Analysis button click handler
document.getElementById('analyze-btn').addEventListener('click', async () => {
    const query = document.getElementById('query-input').value;
    const metric = document.getElementById('metric-select').value;
    
    if (!query) {
        alert('Please enter a search query');
        return;
    }
    
    try {
        switch (metric) {
            case 'timeseries':
                await updateTimeSeries(query);
                break;
            case 'contributors':
                await updateContributors(query);
                break;
            case 'network':
                await updateNetwork(query);
                break;
            case 'topics':
                await updateTopics();
                break;
        }
    } catch (error) {
        alert('Error performing analysis');
        console.error(error);
    }
});

// Time Series Visualization
async function updateTimeSeries(query) {
    const response = await fetch(`/api/timeseries?query=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    const margin = {top: 20, right: 20, bottom: 30, left: 50};
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;
    
    // Clear previous chart
    d3.select('#timeseries').html('');
    
    const svg = d3.select('#timeseries')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    const x = d3.scaleTime()
        .domain(d3.extent(data, d => new Date(d.date)))
        .range([0, width]);
    
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count)])
        .range([height, 0]);
    
    // Add X axis
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x));
    
    // Add Y axis
    svg.append('g')
        .call(d3.axisLeft(y));
    
    // Add the line
    svg.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', 'steelblue')
        .attr('stroke-width', 1.5)
        .attr('d', d3.line()
            .x(d => x(new Date(d.date)))
            .y(d => y(d.count))
        );
}

// Top Contributors Visualization
async function updateContributors(query) {
    const response = await fetch(`/api/top_contributors?query=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    const margin = {top: 20, right: 20, bottom: 100, left: 60};
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;
    
    // Clear previous chart
    d3.select('#contributors').html('');
    
    const svg = d3.select('#contributors')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
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
        .attr('fill', 'steelblue');
}

// Network Visualization
async function updateNetwork(query) {
    const response = await fetch(`/api/network?query=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    // Clear previous chart
    d3.select('#network-graph').html('');
    
    const width = 800;
    const height = 600;
    
    const svg = d3.select('#network-graph')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    const simulation = d3.forceSimulation(data.nodes)
        .force('link', d3.forceLink(data.links).id(d => d.id))
        .force('charge', d3.forceManyBody().strength(-100))
        .force('center', d3.forceCenter(width / 2, height / 2));
    
    const link = svg.append('g')
        .selectAll('line')
        .data(data.links)
        .enter()
        .append('line')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6);
    
    const node = svg.append('g')
        .selectAll('circle')
        .data(data.nodes)
        .enter()
        .append('circle')
        .attr('r', 5)
        .attr('fill', '#69c')
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));
    
    node.append('title')
        .text(d => d.id);
    
    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        
        node
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
    });
    
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

// Topics Visualization
async function updateTopics() {
    const response = await fetch('/api/topics');
    const data = await response.json();
    
    // Clear previous chart
    d3.select('#topics').html('');
    
    const container = d3.select('#topics');
    
    data.forEach(topic => {
        const topicDiv = container.append('div')
            .attr('class', 'topic')
            .style('margin', '10px 0')
            .style('padding', '10px')
            .style('background-color', '#f8f9fa')
            .style('border-radius', '5px');
        
        topicDiv.append('h4')
            .text(`Topic ${topic.topic_id + 1}`);
        
        topicDiv.append('p')
            .text(topic.top_words.join(', '));
    });
} 