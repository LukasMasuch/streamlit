# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# import plotly.graph_objects as go
# import plotly.io as pio

# pio.templates["streamlit"] = go.layout.Template(
#     layout_annotations=[
#         dict(
#             name="streamlit",
#             color_discrete_sequence=["#111111",
#                 "#83C9FF",
#                 "#FF2B2B",
#                 "#FFABAB",
#                 "#29B09D",
#                 "#7DEFA1",
#                 "#FF8700",
#                 "#FFD16A",
#                 "#6D3FC0",
#                 "#D5DAE5"],
#             font=dict(color="red", size=100),
#         )
#     ]
# )
import plotly.graph_objects as go
import plotly.io as pio

pio.templates["draft"] = go.layout.Template(
    # layout_annotations=[
    #     dict(
    #         name="draft watermark",
    #         text="STREAMLIT",
    #         textangle=-30,
    #         opacity=0.1,
    #         font=dict(color="black", size=100),
    #         xref="paper",
    #         yref="paper",
    #         x=0.5,
    #         y=0.5,
    #         showarrow=False,
    #     )
    # ],
    layout=dict(
        colorway=[
            "#000001",  # 0068C9
            "#000002",
            "#000003",
            "#000004",
            "#000005",
            "#000006",
            "#000007",
            "#000008",
            "#000009",
            "#000010",
        ],
    ),
)
