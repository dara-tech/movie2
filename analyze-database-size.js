const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// Import models
const Movie = require('./server/models/Movie');
const TvShow = require('./server/models/TvShow');
const Genre = require('./server/models/Genre');
const User = require('./server/models/User');
const Watchlist = require('./server/models/Watchlist');
const WatchHistory = require('./server/models/WatchHistory');
const Episode = require('./server/models/Episode');
const AdminActivity = require('./server/models/AdminActivity');
const SyncJob = require('./server/models/SyncJob');

// Helper function to format bytes
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Helper function to estimate document size
const estimateDocSize = async (Model, sampleSize = 100) => {
  try {
    const count = await Model.countDocuments();
    if (count === 0) return { avgSize: 0, totalEstimatedSize: 0 };
    
    // Get a sample of documents
    const sample = await Model.find().limit(sampleSize);
    
    // Calculate average size
    const totalSampleSize = sample.reduce((sum, doc) => {
      return sum + JSON.stringify(doc).length;
    }, 0);
    
    const avgSize = totalSampleSize / sample.length;
    const totalEstimatedSize = avgSize * count;
    
    return { avgSize, totalEstimatedSize, count };
  } catch (error) {
    console.error(`Error estimating size for ${Model.modelName}:`, error.message);
    return { avgSize: 0, totalEstimatedSize: 0, count: 0 };
  }
};

// Analyze database
const analyzeDatabase = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const adminDb = db.admin();
    
    // Get database stats
    const stats = await db.stats();
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 MONGODB DATABASE ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    console.log(`📁 Database Name: ${db.databaseName}\n`);
    
    // Overall database stats
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 OVERALL DATABASE STATS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total Collections:     ${stats.collections}`);
    console.log(`Total Documents:       ${stats.objects.toLocaleString()}`);
    console.log(`Total Data Size:       ${formatBytes(stats.dataSize)}`);
    console.log(`Total Storage Size:    ${formatBytes(stats.storageSize)}`);
    console.log(`Total Indexes:         ${stats.indexes}`);
    console.log(`Total Index Size:      ${formatBytes(stats.indexSize)}`);
    console.log();
    
    // Analyze each collection
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 COLLECTION DETAILS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const collections = [
      { name: 'Movie', model: Movie, description: 'Movies' },
      { name: 'TvShow', model: TvShow, description: 'TV Shows' },
      { name: 'Genre', model: Genre, description: 'Genres' },
      { name: 'User', model: User, description: 'Users' },
      { name: 'Watchlist', model: Watchlist, description: 'Watchlist Items' },
      { name: 'WatchHistory', model: WatchHistory, description: 'Watch History' },
      { name: 'Episode', model: Episode, description: 'Episodes' },
      { name: 'AdminActivity', model: AdminActivity, description: 'Admin Activities' },
      { name: 'SyncJob', model: SyncJob, description: 'Sync Jobs' }
    ];
    
    let totalCount = 0;
    
    for (const collection of collections) {
      try {
        // Get collection stats from MongoDB
        const collStats = await db.command({ collStats: collection.model.collection.collectionName });
        const count = await collection.model.countDocuments();
        
        totalCount += count;
        
        // Get indexes
        const indexes = await collection.model.collection.indexes();
        
        console.log(`\n📂 ${collection.description} (${collection.model.collection.collectionName})`);
        console.log(`   Documents:           ${count.toLocaleString()}`);
        console.log(`   Avg Document Size:   ${collStats.avgObjSize ? formatBytes(collStats.avgObjSize) : 'N/A'}`);
        console.log(`   Total Data Size:     ${formatBytes(collStats.size)}`);
        console.log(`   Storage Size:        ${formatBytes(collStats.storageSize)}`);
        console.log(`   Total Index Size:    ${formatBytes(collStats.totalIndexSize)}`);
        console.log(`   Number of Indexes:   ${indexes.length}`);
        
        // Show indexes
        if (indexes.length > 0) {
          console.log(`   Indexes:`);
          indexes.forEach(index => {
            const keys = Object.keys(index.key).join(', ');
            const unique = index.unique ? ' (unique)' : '';
            console.log(`     - ${keys}${unique}`);
          });
        }
        
      } catch (error) {
        console.log(`\n📂 ${collection.description} (${collection.model.collection.collectionName})`);
        console.log(`   ⚠️  Collection not found or error: ${error.message}`);
      }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📈 STORAGE BREAKDOWN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Calculate percentages
    const dataSizePercentage = ((stats.dataSize / stats.storageSize) * 100).toFixed(2);
    const indexSizePercentage = ((stats.indexSize / stats.storageSize) * 100).toFixed(2);
    
    console.log(`\nData Storage:     ${formatBytes(stats.dataSize)} (${dataSizePercentage}%)`);
    console.log(`Index Storage:    ${formatBytes(stats.indexSize)} (${indexSizePercentage}%)`);
    console.log(`Total Storage:    ${formatBytes(stats.storageSize)} (100%)`);
    
    // Additional insights
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 INSIGHTS & RECOMMENDATIONS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (stats.indexSize > stats.dataSize * 0.5) {
      console.log('⚠️  Index size is large compared to data size');
      console.log('   Consider: Reviewing and removing unused indexes\n');
    }
    
    if (stats.collections > 10) {
      console.log('⚠️  High number of collections');
      console.log('   Consider: Consolidating related collections\n');
    }
    
    const storageGB = stats.storageSize / (1024 * 1024 * 1024);
    if (storageGB > 1) {
      console.log('✅ Database is optimized for medium-scale production');
      console.log('   Current size: ' + formatBytes(stats.storageSize) + '\n');
    } else {
      console.log('✅ Database size is manageable');
      console.log('   Current size: ' + formatBytes(stats.storageSize) + '\n');
    }
    
    // Growth estimate
    const movieCount = await Movie.countDocuments();
    const tvShowCount = await TvShow.countDocuments();
    const userCount = await User.countDocuments();
    
    console.log('📊 CONTENT STATISTICS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`Movies:           ${movieCount.toLocaleString()}`);
    console.log(`TV Shows:         ${tvShowCount.toLocaleString()}`);
    console.log(`Users:            ${userCount.toLocaleString()}`);
    console.log(`Genres:           ${await Genre.countDocuments()}`);
    console.log(`Watchlist Items:  ${await Watchlist.countDocuments()}`);
    console.log(`Watch History:    ${await WatchHistory.countDocuments()}`);
    console.log(`Episodes:         ${await Episode.countDocuments()}`);
    
    console.log('\n═══════════════════════════════════════════════════════════════\n');
    
    await mongoose.connection.close();
    console.log('👋 Database connection closed');
    
  } catch (error) {
    console.error('❌ Error analyzing database:', error);
    process.exit(1);
  }
};

// Run the analysis
analyzeDatabase();

