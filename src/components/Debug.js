import React, {
  useRef,
  useState,
} from 'react';

import axios from 'axios';

import { Button } from '@mui/material';

import sampleLinks from '../schema/sample_links.json';
import { InputComponent } from './MatchPage';

const api = axios.create({
    baseURL: "https://05mmsalcn1.execute-api.us-east-1.amazonaws.com/development",
});

export async function runGKB2ApiTests() {
    const requests = [
        api.post("/inputToVocab", { input: "beta cell" }),
        api.post("/nodeTypeDictionary", { nodeType: "gene" }),
        api.post("/onprem", { query: "MATCH (n) RETURN n LIMIT 5" }),
        api.post("/queryResultToVisualization", { query: "MATCH (n) RETURN n LIMIT 5" }),
        api.post("/tripletsToViewSchema", { sourceTerm: "snp@rs2402203", relationship: "QTL", targetTerm: "gene@ENSG00000001626" }),
        api.post("/gkb2ResultPage", {
            core_cypher: "debug",
            neighbor_cypher: "debug",
        }),
        api.post("/gkb2ResultPage", {
            core_cypher: "MATCH (n) RETURN n LIMIT 5",
            neighbor_cypher: "MATCH (n)-[r]->(m) RETURN p=(n)-[r]->(m) LIMIT 5",
        }),
        api.post("/RDSLambdaPostgreSQL", { query: "test" }),
        api.post("/aiChat", {
            message: "What is a gene?",
            conversationId: "test-conv-001",
            context: { domain: "biology", user_type: "researcher" },
        }),
        api.post("/aiSummary", {
            text: "Genes are the basic units of heredity and are made up of DNA. They contain the instructions for making proteins, which are essential for the structure and function of all living organisms. Genes are located on chromosomes and can be passed from parents to offspring. Mutations in genes can lead to genetic disorders or diseases. The study of genes and their functions is called genetics, which has important applications in medicine, agriculture, and biotechnology.",
            maxLength: 50,
        }),
        api.post("/aiRephrase", {
            text: "This research paper discusses the genetic factors involved in disease susceptibility.",
            style: "casual",
            language: "en",
        }),
    ];

    const results = await Promise.allSettled(requests);

    results.forEach((result, idx) => {
        if (result.status === "rejected") {
            console.error(`Request ${idx + 1} failed:`, result.reason);
        }
    });
}

export default function DebugPage() {
    const [graphJson, setGraphJson] = useState("");
    const [inputValue, setInputValue] = useState('');
    const [termString, setTermString] = useState('');
    const [inputStatus, setInputStatus] = useState('empty');
    const [clearTrigger, setClearTrigger] = useState(0);
    // const cyRef = useRef(null);
    // const containerRef = useRef(null);
    // const [cy, setCy] = useState(null);
    // const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
    // const img = new window.Image();
    // const [cyStyle, setCyStyle] = useState([]);
    // useEffect(() => {
    //     img.src = Image;
    //     img.onload = () => {
    //         console.log("Image loaded:", img.width);
    //         setImgSize({ width: img.width, height: img.height });
    //     }
    // }, []);
    // // Initialize Cytoscape
    // useEffect(() => {
    //     console.log(imgSize);
    //     const imgSize1 = imgSize;
    //     setCyStyle([
    //         {
    //             selector: "node",
    //             style: {
    //                 label: "something here",
    //                 "text-valign": "bottom",
    //                 "font-size": "50px",
    //                 'shape': 'rectangle',
    //                 height: imgSize1.height || 100,
    //                 width: imgSize1.width || 100,
    //                 'background-opacity': 0,
    //                 'background-image': Image,
    //                 'background-fit': 'none',
    //                 'background-clip': 'none',
    //                 'background-position-x': '0%',
    //                 'background-position-y': '0%',
    //             },
    //         },
    //         {
    //             selector: "edge",
    //             style: {
    //                 "line-color": "#ccc",
    //                 "target-arrow-color": "#ccc",
    //                 "target-arrow-shape": "triangle",
    //                 "curve-style": "bezier",
    //                 "target-arrow-shape": "vee",
    //                 "arrow-scale": 5,
    //             },
    //         },
    //     ]);
    //     if (containerRef.current && !cy) {
    //         const cyInstance = cytoscape({
    //             container: containerRef.current,
    //             elements: [],
    //             style: [],
    //             layout: { name: "grid" },
    //         });
    //         setCy(cyInstance);
    //     }
    // }, [cy, imgSize]);

    // // Handle file upload
    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                console.log("Loaded JSON:", json);
                setGraphJson(json);
            } catch (err) {
                console.error("Invalid JSON file:", err);
            }
        };
        reader.readAsText(file);
    };
    const cyRef = useRef(null);

    // useEffect(() => {
    //     if (!graphJson || !graphJson?.graph) {
    //         return;
    //     }
    //     const result = graphJson?.graph;
    //     const positionData =
    //         Object.fromEntries(
    //             Object.entries(graphJson?.coords || {}).map(([key, value]) => [
    //                 key,
    //                 {
    //                     ...value,
    //                     x: value.x / 2.0,
    //                     y: value.y / 2.0,
    //                 },
    //             ])
    //         ) || {};

    //     const uniqueNodesMap = {};
    //     result.nodes.forEach((node) => (uniqueNodesMap[node["~id"]] = node));
    //     const nodes = Object.values(uniqueNodesMap).map((node) => {
    //         // Determine type based on the labels
    //         const type = node["~labels"][0];
    //         // Use the provided positionData and extract the Level property.
    //         const posData = positionData[node["~id"]] || {
    //             x: Math.random() * 250 - 125,
    //             y: Math.random() * 200 - 125,
    //             Level: "Core",
    //         };
    //         const pos = { x: posData.x, y: posData.y };
    //         return {
    //             data: {
    //                 id: node["~id"],
    //                 label: (
    //                     node["~id"]
    //                 ).replace(/_/g, " "),
    //                 type,
    //                 Level: posData.Level,
    //             },
    //             position: pos,
    //         };
    //     });

    //     const uniqueEdgesMap = {};
    //     result.edges.forEach((edge, index) => (uniqueEdgesMap[edge["~id"] || index.toString()] = edge));
    //     const edges = Object.values(uniqueEdgesMap).map((edge) => ({
    //         data: {
    //             id: edge["~id"],
    //             source: edgeIsInverted[edge["~type"]] ? edge["~end"] : edge["~start"],
    //             target: edgeIsInverted[edge["~type"]] ? edge["~start"] : edge["~end"],
    //             type: edge["~type"],
    //             label: edgeLabels[edge["~type"]] || edge["~type"],
    //             ...edge["~properties"],
    //         },
    //     }));

    //     cyRef.current = cytoscape({
    //         container: document.getElementById("cy-container"),
    //         elements: { nodes, edges },
    //         style: nodeStyle.concat([{
    //             selector: `node[type = "region"]`,
    //             style: {
    //                 "text-valign": "bottom",
    //                 "border-width": "0px",
    //                 'shape': 'rectangle',
    //                 "text-margin-y": "-5px",
    //                 "background-position-y": "0px",
    //                 // height: 40,
    //                 // width: 112,
    //                 height: 15,
    //                 width: 42,
    //                 'background-opacity': 0,
    //                 'background-image': Image,
    //                 'background-fit': 'contain',
    //                 'background-clip': 'none',
    //                 'background-position-x': '0%',
    //                 "font-size": "5px",
    //             },
    //         }]),
    //         layout: { name: "preset" },
    //         zoom: 1.5,
    //         minZoom: 1.2,
    //         maxZoom: 4,
    //         pan: { x: 0, y: 0 },
    //     });

    //     const cy = cyRef.current;
    //     cy.reset();
    //     cy.center();

    //     return () => {
    //         document.body.style.cursor = "default";
    //         cyRef.current.removeAllListeners();
    //     };
    // }, [graphJson]);

    return (
        <>
            {/* <div className="p-4 space-y-4">
                <Button
                    onClick={() => {
                        cyRef.current.click();
                    }}
                >
                    Upload JSON File
                </Button>
                <input
                    type="file"
                    accept=".json"
                    ref={cyRef}
                    onChange={handleFileUpload}
                    style={{ display: "none" }}
                />

                <div
                    id="cy-container"
                    style={{
                        width: "100%",
                        height: "600px",
                        backgroundColor: "#F9FAFB",
                        border: "none",
                        borderRadius: "8px",
                        position: "relative",
                    }}
                >
                </div>
            </div> */}
            <div style={{ padding: '20px', width: '1440px' }}>
                <Button
                    onClick={() => {
                        runGKB2ApiTests();
                    }}
                >
                    Connection Test
                </Button>
                <InputComponent
                    type="gene"
                    setValue={setInputValue}
                    setTermString={setTermString}
                    setInputStatus={setInputStatus}
                    disabled={false}
                    clearTrigger={clearTrigger}
                    defaultValue={"cftr"}
                />
                <Button
                    onClick={() => {
                        setClearTrigger((prev) => prev + 1);
                    }}
                >
                    Clear
                </Button>
                <h4>Input Value: {inputValue}</h4>
                <h4>Term String: {termString}</h4>
                <h4>Input Status: {inputStatus}</h4>
                <hr style={{ margin: '20px 0' }} />
                <h1>Links for Debug Quick Redirect</h1>
                {[
                    ["match_page", "Match Page"],
                    ["intermediate_page", "Intermediate Page"],
                    ["result_page", "Result Page"]
                ].map(([key, title]) => (<>
                    <h3 key={key}>{title}</h3>
                    {
                        sampleLinks[key].map((item, index) => (
                            <div key={index}>
                                <a href={`${item.root}?${new URLSearchParams(item.dictionary).toString()}`} target="_blank" rel="noopener noreferrer" style={{
                                    wordWrap: 'break-word',
                                    maxWidth: '100%',
                                }}>
                                    {`${item.root}?${new URLSearchParams(item.dictionary).toString()}`}
                                </a>
                                <ul>
                                    {Object.entries(item.dictionary).map(([key, value], linkIndex) => (
                                        <li key={linkIndex}>
                                            {key}: {value}
                                        </li>
                                    ))}
                                </ul>
                                {item['$comment'] && (
                                    <p style={{ color: 'red' }}>
                                        {item['$comment']}
                                    </p>
                                )}
                            </div>
                        ))
                    }</>
                ))}
            </div>
        </>
    );
}