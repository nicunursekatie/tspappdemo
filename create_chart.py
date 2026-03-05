import matplotlib.pyplot as plt

# TSP Brand Colors
colors = {'primary': '#236383', 'teal': '#007E8C', 'orange': '#FBAD3F'}


def create_impact_chart():
    fig, ax = plt.subplots(figsize=(8, 4))

    # Data: Cost vs Value
    labels = ['Cost to Make', 'Community Value']
    values = [1.44, 6.34]  # Based on your dashboard sources [534, 540]

    # Horizontal Bar Chart
    bars = ax.barh(labels, values, color=[colors['primary'], colors['orange']])

    # Styling to match your "Clean/Concise" preference
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['bottom'].set_visible(False)
    ax.get_xaxis().set_visible(False)

    # Add huge labels
    for i, v in enumerate(values):
        ax.text(v + 0.1,
                i,
                f"${v:.2f}",
                va='center',
                fontweight='bold',
                fontsize=20,
                color='#333')

    ax.set_title("The Sandwich Project Multiplier",
                 fontsize=14,
                 fontweight='bold',
                 loc='left')
    plt.tight_layout()
    plt.savefig('tsp_impact.png', dpi=300)


create_impact_chart()
