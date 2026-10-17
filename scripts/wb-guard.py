"""Import pinned ru WB tools; stop a blocked endpoint before legacy fallback.
No upstream source modifications or change to parsing/money units.
"""
from fastmcp.exceptions import ToolError
from wb_connector import server

original_get = server._safe_get_text


async def guarded_get(*args, **kwargs):
    status, text, error = await original_get(*args, **kwargs)
    if status in (401, 403, 429, 498) or server._is_edge_wall(text):
        raise ToolError(f"scout_source_blocked HTTP {status}")
    return status, text, error


if __name__ == "__main__":
    server._safe_get_text = guarded_get
    server.mcp.run(transport="stdio")
