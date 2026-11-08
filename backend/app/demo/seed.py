from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.all_models import (
    Document,
    DocumentChunk,
    Dungeon,
    DungeonRoom,
    Question,
    Topic,
    User,
)

DEMO_DATA = {
    "title": "Computer Systems & Architecture (Seeded Demo)",
    "topics": [
        {
            "name": "Central Processing Unit (CPU)",
            "description": "Registers, ALU, Control Unit, and the Fetch-Decode-Execute cycle.",
            "monster_type": "Silicon Golem",
            "monster_hp": 80,
            "chunk_text": "The Central Processing Unit (CPU) executes computer program instructions. The Arithmetic Logic Unit (ALU) performs basic mathematical arithmetic and logic operations. The Control Unit coordinates operations by directing data flows. Registers provide fast, temporary storage directly inside the processor.",
            "questions": [
                {
                    "prompt": "Which component of the CPU carries out mathematical and logical calculations?",
                    "options": ["Control Unit", "Arithmetic Logic Unit (ALU)", "Program Counter", "Memory Data Register"],
                    "correct_option": 1,
                    "difficulty": "easy",
                    "evidence_quote": "The Arithmetic Logic Unit (ALU) performs basic mathematical arithmetic and logic operations.",
                    "explanation": "The ALU is responsible for calculations and boolean evaluations inside the CPU.",
                },
                {
                    "prompt": "What is the primary function of CPU registers?",
                    "options": ["Permanent secondary storage", "High-speed temporary internal storage", "Displaying pixels to monitors", "Cooling down processor cores"],
                    "correct_option": 1,
                    "difficulty": "medium",
                    "evidence_quote": "Registers provide fast, temporary storage directly inside the processor.",
                    "explanation": "Registers are tiny, ultra-fast memory cells located within the CPU core.",
                },
            ],
        },
        {
            "name": "Primary & Secondary Storage",
            "description": "Volatile RAM vs Non-volatile SSDs, Hard Drives, and Cache memory hierarchy.",
            "monster_type": "Memory Wraith",
            "monster_hp": 90,
            "chunk_text": "Random Access Memory (RAM) is volatile main memory that loses all stored data when electrical power is disconnected. Solid State Drives (SSDs) utilize flash memory to retain non-volatile data persistently across reboots.",
            "questions": [
                {
                    "prompt": "Why is RAM classified as volatile memory?",
                    "options": ["It can easily physically break", "It loses its data when power is turned off", "It operates at slower speeds than magnetic disks", "It can only be written to once"],
                    "correct_option": 1,
                    "difficulty": "easy",
                    "evidence_quote": "Random Access Memory (RAM) is volatile main memory that loses all stored data when electrical power is disconnected.",
                    "explanation": "Volatile memory requires continuous electrical power to preserve stored bits.",
                },
                {
                    "prompt": "Which technology do SSDs utilize for non-volatile storage?",
                    "options": ["Spinning magnetic platters", "Flash memory", "Cathode ray tubes", "Dynamic optical laser pits"],
                    "correct_option": 1,
                    "difficulty": "medium",
                    "evidence_quote": "Solid State Drives (SSDs) utilize flash memory to retain non-volatile data persistently across reboots.",
                    "explanation": "SSDs use semiconductor flash memory instead of spinning magnetic disks.",
                },
            ],
        },
        {
            "name": "Computer Networking & Protocols",
            "description": "IP addressing, TCP packet delivery, DNS resolution, and HTTP layers.",
            "monster_type": "Packet Spectre",
            "monster_hp": 85,
            "chunk_text": "The Transmission Control Protocol (TCP) ensures reliable, ordered packet delivery by requiring acknowledgments and retransmitting lost packets. Domain Name System (DNS) translates human-readable domain names into numerical IP addresses.",
            "questions": [
                {
                    "prompt": "What does the Domain Name System (DNS) do on the Internet?",
                    "options": ["Encrypts browser passwords", "Translates domain names into numerical IP addresses", "Compresses web images", "Blocks unauthorized network ports"],
                    "correct_option": 1,
                    "difficulty": "easy",
                    "evidence_quote": "Domain Name System (DNS) translates human-readable domain names into numerical IP addresses.",
                    "explanation": "DNS acts as the phonebook of the internet.",
                },
            ],
        },
        {
            "name": "The Final Architecture Exam",
            "description": "Comprehensive integration boss room covering all computer components.",
            "monster_type": "The Exam Warden (Boss)",
            "monster_hp": 220,
            "chunk_text": "A complete von Neumann computer architecture tightly integrates the processor, main memory, and input/output mechanisms via system buses to execute algorithms reliably.",
            "questions": [
                {
                    "prompt": "In von Neumann computer architecture, which subsystem interconnects the CPU, memory, and I/O devices?",
                    "options": ["System Bus", "Power Supply Unit", "Audio Codec", "Cooling Heatsink"],
                    "correct_option": 0,
                    "difficulty": "hard",
                    "evidence_quote": "A complete von Neumann computer architecture tightly integrates the processor, main memory, and input/output mechanisms via system buses to execute algorithms reliably.",
                    "explanation": "System buses carry address, data, and control signals between components.",
                },
            ],
        },
    ],
}


async def seed_demo_dungeon(db: AsyncSession) -> Dungeon:
    # Check if demo dungeon already exists
    res = await db.execute(select(Dungeon).where(Dungeon.is_public_demo == True))
    existing = res.scalar_one_or_none()
    if existing:
        return existing

    # Create system user if needed
    sys_user_res = await db.execute(select(User).where(User.username == "system_demo"))
    sys_user = sys_user_res.scalar_one_or_none()
    if not sys_user:
        sys_user = User(username="system_demo", is_guest=False, password_hash=None)
        db.add(sys_user)
        await db.flush()

    # Create Document
    doc = Document(
        user_id=sys_user.id,
        title=DEMO_DATA["title"],
        original_filename="computer_systems_seed.txt",
        file_type="txt",
        status="accepted",
        relevance_score=0.99,
        readability_score=0.99,
    )
    db.add(doc)
    await db.flush()

    # Create Dungeon
    dungeon = Dungeon(
        user_id=sys_user.id,
        document_id=doc.id,
        title=DEMO_DATA["title"],
        is_public_demo=True,
    )
    db.add(dungeon)
    await db.flush()

    # Create Topics, Chunks, Rooms & Questions
    for order, topic_data in enumerate(DEMO_DATA["topics"]):
        # Chunk
        chunk = DocumentChunk(
            document_id=doc.id,
            user_id=sys_user.id,
            chunk_index=order,
            text=topic_data["chunk_text"],
            page_number=order + 1,
        )
        db.add(chunk)
        await db.flush()

        # Topic
        topic = Topic(
            document_id=doc.id,
            user_id=sys_user.id,
            name=topic_data["name"],
            description=topic_data["description"],
            order_index=order,
        )
        db.add(topic)
        await db.flush()

        # Dungeon Room
        room = DungeonRoom(
            dungeon_id=dungeon.id,
            topic_id=topic.id,
            room_order=order,
            monster_type=topic_data["monster_type"],
            monster_hp=topic_data["monster_hp"],
        )
        db.add(room)

        # Questions
        for q_data in topic_data["questions"]:
            q = Question(
                topic_id=topic.id,
                source_chunk_id=chunk.id,
                question_type="mcq",
                difficulty=q_data["difficulty"],
                prompt=q_data["prompt"],
                options=q_data["options"],
                correct_option=q_data["correct_option"],
                evidence_quote=q_data["evidence_quote"],
                explanation=q_data["explanation"],
            )
            db.add(q)

    await db.commit()
    await db.refresh(dungeon)
    return dungeon

