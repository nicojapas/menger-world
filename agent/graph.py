"""
LangGraph agent for controlling visual parameters based on conversation.
"""

import os
from typing import TypedDict, Annotated, Sequence, Optional
from langchain_groq import ChatGroq
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages

from parameters import AgentResponse
from prompt import SYSTEM_PROMPT


class AgentState(TypedDict):
    """State maintained across the conversation."""
    messages: Annotated[Sequence[BaseMessage], add_messages]
    current_params: dict
    pending_params: Optional[dict]
    pending_speech: Optional[str]


def create_agent(groq_api_key: str = None):
    """Create the LangGraph agent.

    Args:
        groq_api_key: Groq API key (BYOK). Falls back to env var if not provided.
    """
    # Use provided key or fall back to environment variable
    api_key = groq_api_key or os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("Groq API key required. Provide via BYOK or GROQ_API_KEY env var.")

    # Initialize the LLM (Groq - free tier with fast inference)
    # Using 8B model: cheaper, faster, and more obedient to persona instructions
    llm = ChatGroq(
        model="llama-3.1-8b-instant",
        api_key=api_key,
        temperature=0.7
    )

    # Use structured output to guarantee valid response format
    structured_llm = llm.with_structured_output(AgentResponse)

    def process_input(state: AgentState) -> AgentState:
        """Process user input and generate response with parameter changes."""
        messages = list(state["messages"])

        # Always prepend system message to reinforce personality
        messages = [SystemMessage(content=SYSTEM_PROMPT)] + messages

        # Get structured LLM response with error handling
        try:
            response: AgentResponse = structured_llm.invoke(messages)
        except Exception:
            # Fallback response on LLM failure
            return {
                "messages": list(state["messages"]) + [AIMessage(content="I'm having trouble processing that.")],
                "current_params": state.get("current_params", {}),
                "pending_params": None,
                "pending_speech": "I'm having trouble processing that."
            }

        # Extract params from the structured response
        params = response.get_params_dict()

        # Update state
        new_messages = list(state["messages"]) + [AIMessage(content=response.speech)]

        # Merge new params with current
        current_params = state.get("current_params", {})
        if params:
            current_params = {**current_params, **params}

        return {
            "messages": new_messages,
            "current_params": current_params,
            "pending_params": params,
            "pending_speech": response.speech
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

    def __init__(self, groq_api_key: str = None):
        """
        Initialize the visual agent.

        Args:
            groq_api_key: Groq API key (BYOK). Falls back to env var if not provided.
        """
        self.graph = create_agent(groq_api_key=groq_api_key)
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
