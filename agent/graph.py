"""
LangGraph agent for controlling visual parameters based on conversation.
"""

import os
from typing import TypedDict, Annotated, Sequence, Optional
from langchain_groq import ChatGroq
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages

from parameters import VisualParameters, to_frontend_params
from prompt import SYSTEM_PROMPT


class AgentState(TypedDict):
    """State maintained across the conversation."""
    messages: Annotated[Sequence[BaseMessage], add_messages]
    current_params: dict
    pending_params: Optional[dict]
    pending_speech: Optional[str]


def parse_params_from_response(response: str) -> tuple[str, Optional[dict]]:
    """
    Extract parameters from the response text.

    Returns:
        Tuple of (clean_text, params_dict or None)
    """
    import re

    # Find [PARAMS: ...] block
    pattern = r'\[PARAMS:\s*([^\]]+)\]'
    match = re.search(pattern, response)

    params = None
    if match:
        # Parse the parameters
        params_str = match.group(1)
        params = {}

        for pair in params_str.split(','):
            pair = pair.strip()
            if '=' in pair:
                key, value = pair.split('=', 1)
                key = key.strip()
                value = value.strip()

                # Convert to float and add to params
                try:
                    params[key] = float(value)
                except ValueError:
                    pass  # Skip malformed values

    # Remove the params block from the text
    clean_text = re.sub(pattern, '', response).strip()

    # Remove leaked parameter-related phrases (LLM sometimes doesn't follow format)
    leaked_phrases = [
        r'(?i)parameters?\s*(set|adjusted|changed|updated|configured)\.?',
        r'(?i)adjusting\s*(the\s*)?parameters?\.?',
        r'(?i)setting\s*(the\s*)?parameters?\.?',
        r'(?i)updating\s*(the\s*)?parameters?\.?',
        r'(?i)visual\s*(settings?|params?)\s*(set|adjusted|changed)?\.?',
    ]
    for phrase in leaked_phrases:
        clean_text = re.sub(phrase, '', clean_text).strip()

    # Clean up any double spaces or trailing punctuation artifacts
    clean_text = re.sub(r'\s{2,}', ' ', clean_text).strip()
    clean_text = re.sub(r'^\.\s*', '', clean_text).strip()

    return clean_text, params


def create_agent():
    """Create the LangGraph agent."""

    # Initialize the LLM (Groq - free tier with fast inference)
    # Using 8B model: cheaper, faster, and more obedient to persona instructions
    llm = ChatGroq(
        model="llama-3.1-8b-instant",
        api_key=os.getenv("GROQ_API_KEY"),
        max_tokens=80,
        temperature=0.7
    )

    def process_input(state: AgentState) -> AgentState:
        """Process user input and generate response with parameter changes."""
        messages = list(state["messages"])

        # Always prepend system message to reinforce personality
        messages = [SystemMessage(content=SYSTEM_PROMPT)] + messages

        # Get LLM response
        response = llm.invoke(messages)
        response_text = response.content

        # Parse out any parameter changes
        clean_text, params = parse_params_from_response(response_text)

        # Update state
        new_messages = list(state["messages"]) + [AIMessage(content=clean_text)]

        # Merge new params with current
        current_params = state.get("current_params", {})
        if params:
            current_params = {**current_params, **params}

        return {
            "messages": new_messages,
            "current_params": current_params,
            "pending_params": params,
            "pending_speech": clean_text
        }

    # Build the graph
    workflow = StateGraph(AgentState)

    # Add nodes
    workflow.add_node("process", process_input)

    # Set entry point
    workflow.set_entry_point("process")

    # Add edge to end
    workflow.add_edge("process", END)

    # Compile
    return workflow.compile()


class VisualAgent:
    """High-level interface to the visual control agent."""

    def __init__(self):
        self.graph = create_agent()
        self.state: AgentState = {
            "messages": [],
            "current_params": {},
            "pending_params": None,
            "pending_speech": None
        }

    def process_user_input(self, user_text: str) -> tuple[str, Optional[dict]]:
        """
        Process user input and return agent response with any parameter changes.

        Args:
            user_text: What the user said

        Returns:
            Tuple of (agent_response_text, params_dict or None)
        """
        # Add user message to state
        self.state["messages"] = list(self.state["messages"]) + [
            HumanMessage(content=user_text)
        ]

        # Run the graph
        result = self.graph.invoke(self.state)

        # Update our state
        self.state = result

        return result["pending_speech"], result["pending_params"]

    def get_initial_greeting(self) -> tuple[str, Optional[dict]]:
        """Get the agent's opening message."""
        greeting = "Hello good friend. How are you feeling today?"
        initial_params = {
            "rounding": 0.02,
            "domain_warp": 0.0,
            "breathing_speed": 1.2,
            "layer_2_density": 0.5,
            "layer_3_density": 0.5,
            "base_color_r": 0.95,
            "base_color_g": 0.95,
            "base_color_b": 0.97
        }
        return greeting, initial_params

    def get_current_params(self) -> dict:
        """Get the current parameter values."""
        return self.state["current_params"]
